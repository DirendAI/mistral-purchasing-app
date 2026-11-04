"""The versioned API, served only to an authenticated caller.

Every module beneath this package inherits the access rule declared here: the gateway must have
authenticated the request (a caller token present), and the caller's principal id is what the
routes receive. A subtree that wants anonymous access must live outside ``v1``, like ``internal``.
"""

from fastapi import params

from ._auth import require_caller

dependencies: tuple[params.Depends, ...] = (params.Depends(require_caller),)
