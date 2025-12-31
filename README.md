# ERPNext Site Check-In (Angular)

Single-page Angular app for site supervisors to check employees **IN/OUT** directly against ERPNext (no custom backend). Supports API Key/Secret or session cookie login, maps the logged-in user to their Employee record, lists assigned employees, captures photo + GPS, creates Employee Checkin, and uploads the photo to the created doc.

## Quick start

> Requires Node 18+. Angular dependencies are declared in `package.json`.

```bash
npm install          # install dependencies (requires access to npm registry)
npm start            # ng serve
npm run build        # production build
```

## Highlights
- API key/secret preferred (Authorization: `token <key>:<secret>`); username/password as fallback via `/api/method/login` with `withCredentials=true`.
- Supervisor mapping: logged-in user matched to `Employee` by `user_id`, then `personal_email`, then `company_email`.
- Employee list: `custom_site_supervisor = supervisorEmployeeId`, plus the supervisor at the top.
- Check-in/out: creates `Employee Checkin` with custom fields for supervisor, GPS, and idempotent `custom_client_uuid`; uploads photo via `/api/method/upload_file`.

## ERPNext endpoints used
- `GET /api/method/frappe.auth.get_logged_user`
- `POST /api/method/login`
- `GET /api/resource/Employee`
- `POST /api/resource/Employee Checkin`
- `POST /api/method/upload_file`

## Security notes
- Credentials are kept in memory; optional “Remember me” stores them only in `sessionStorage`.
- No localStorage usage. For cookie mode, ERPNext must allow the SPA origin and credentials in CORS.

## Troubleshooting login (status 0 / Unknown Error)
- Ensure `https://cya.wkksa.com` is reachable from the browser and has a valid certificate (self-signed/invalid certs are blocked by browsers).
- Configure ERPNext CORS: allow this app’s origin, allow `Authorization` header, and enable credentials for `/api/method/login` and subsequent requests.
- If using API key/secret, no cookies are required; if using username/password, cookies must be allowed cross-site.

## Directory layout
- `src/app/core` — auth, API client, employee + attendance services, guards.
- `src/app/features` — login, dashboard, employee action sheet.
- `src/app/models` — typed ERPNext models.
