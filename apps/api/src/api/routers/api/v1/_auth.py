"""Caller authentication for the v1 API: the gateway's token resolves to a stable principal id.

The Apps gateway puts a short-lived token on every request it authenticates; ``current_token``
reads it. The token is exchanged once for the caller's principal id through ``/v1/whoami``, acting
as the caller via the gateway proxy, and cached by token hash so no raw token is kept in memory.
Routes receive that id as their user key, which is what scopes every row they touch.
"""

import hashlib
from collections import OrderedDict
from typing import Annotated

from fastapi import Depends, HTTPException, status
from mistralai_capabilities.apps.tokens import current_token
from utils.mistral import caller_mistral_client

# Tokens are short-lived; the cache only needs to cover the ones in flight plus slack.
_CACHE_MAX_ENTRIES = 4096
_principal_ids: OrderedDict[str, str] = OrderedDict()


async def _resolve_principal_id(token: str) -> str:
    key = hashlib.sha256(token.encode()).hexdigest()
    cached = _principal_ids.get(key)
    if cached is not None:
        _principal_ids.move_to_end(key)
        return cached
    principal = (await caller_mistral_client().beta.users.whoami_async()).principal
    principal_id = getattr(principal, "id", None)
    resolved = f"{principal.principal_type}:{principal_id}" if principal_id is not None else f"token:{key}"
    _principal_ids[key] = resolved
    _principal_ids.move_to_end(key)
    while len(_principal_ids) > _CACHE_MAX_ENTRIES:
        _principal_ids.popitem(last=False)
    return resolved


async def require_caller() -> str:
    """The principal id of the signed-in caller the gateway authenticated, or 401."""
    token = current_token()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This app requires sign-in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await _resolve_principal_id(token)


CurrentUser = Annotated[str, Depends(require_caller)]
