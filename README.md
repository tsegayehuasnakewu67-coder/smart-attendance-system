# Smart Attendance Management System

## Backend installation

```powershell
cd backEnd
npm install
```

The backend uses Express, Mongoose, bcryptjs, and JWT. No local `mongod` is
required when `MONGODB_URI` points to MongoDB Atlas.

## MongoDB and environment configuration

For local MongoDB on Windows, install MongoDB Community Server and start its
service from an elevated PowerShell prompt:

```powershell
Get-Service *Mongo*
Start-Service MongoDB
```

The service may have a different name depending on the installation. You can
also use MongoDB Atlas by setting `MONGODB_URI` to its `mongodb+srv://` URI.

Create `backEnd/.env` (or copy `backEnd/.env.example`) and set:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/SmartAttendanceDB
MONGODB_DB_NAME=SmartAttendanceDB
RUN_EMPLOYEE_MIGRATION=false
JWT_SECRET=<a random secret of at least 32 characters>
JWT_EXPIRES_IN=7d
ADMIN_NAME=System Administrator
ADMIN_EMAIL=admin@smartattendance.com
ADMIN_PASSWORD=<a unique password of at least 8 characters>
CLIENT_URL=http://localhost:5173
```

Never commit `.env`. The initial administrator password is read from
`ADMIN_PASSWORD` and hashed with bcrypt before it is stored.

The employee migration can update existing attendance records and indexes, so
it is disabled by default. Set `RUN_EMPLOYEE_MIGRATION=true` only when you
intend to run it against this database and have reviewed/backed up the data.

## Ethiopia time and calendar

Attendance decisions, scheduled attendance jobs, and recorded event times use
the `Africa/Addis_Ababa` time zone (UTC+03:00). The admin Shift Settings page
keeps the current work schedule at 08:30–17:00 with a 5-minute grace period
and lunch disabled unless an administrator changes it.

Dates and clock times are displayed in the `Africa/Addis_Ababa` time zone;
dates use the Gregorian calendar and times use the 24-hour format. MongoDB
timestamps remain stored in UTC and are converted for display. Attendance date
keys and date-filter inputs remain Gregorian `YYYY-MM-DD` values for API and
database compatibility.

## Seed the database

```powershell
npm run seed
```

The seed command connects to the configured MongoDB database first, then
creates the administrator, departments, sample employees, and sample
attendance records only when those records do not already exist.

## Start the backend

```powershell
npm run dev
```

The API is available at `http://localhost:5000`; check its database status at
`http://localhost:5000/api/health`.
The root `npm run dev` launcher allows up to five minutes for the backend to
connect to MongoDB and finish startup. Set `BACKEND_STARTUP_TIMEOUT_MS` to a
positive number of milliseconds to override that limit.

## Start the frontend

In another terminal:

```powershell
cd frontEnd
npm install
npm run dev
```

The Vite development server uses port `5173`. By default it proxies `/api` to
`http://localhost:5000`. To call the backend directly, create
`frontEnd/.env.local` with `VITE_API_URL=http://localhost:5000/api`.

Admin sign-in uses the `ADMIN_EMAIL` and `ADMIN_PASSWORD` values configured in
`backEnd/.env`. Successful login returns a JWT; protected API requests use it
as a Bearer token.
