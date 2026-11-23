
# PracTrack
### Practicum Hours & Verification System

PracTrack is a web-based practicum management platform designed to simplify On-the-Job Training (OJT) attendance, practicum-hour tracking, schedule management, and record verification.

The system provides dedicated workspaces for **Students, Teachers, Clients, and Administrators**, allowing each role to manage its responsibilities through a centralized platform.

## Live Application

| Service | Link |
|---|---|
| Production Website | https://practrack.netlify.app |
| Backend API | https://practrack.onrender.com |
| API Health Check | https://practrack.onrender.com/api/health |
| GitHub Repository | https://github.com/kimilouie3000/Practrack |

## Main Features

### Student
- Register and manage a student account.
- Complete personal and academic information.
- Clock in and out for practicum attendance.
- Submit manual attendance records.
- View schedules, attendance history, and recorded hours.
- Monitor approved and remaining practicum hours.
- Correct and resubmit rejected records.

### Teacher
- Monitor assigned students and their progress.
- Review and approve or reject attendance submissions.
- View student schedules and practicum records.
- Submit student evaluations.
- Request record or schedule adjustments.

### Client / Host Supervisor
- View assigned students.
- Monitor approved attendance and practicum progress.
- Access relevant student records and information.

### Administrator
- Monitor system activity and practicum statistics.
- Manage students and account information.
- Create Teacher and Client accounts.
- Activate or deactivate accounts.
- Reset user passwords.
- Assign Students to Teachers and Clients.
- Manage schedules and attendance records.
- Review adjustment requests and hour approvals.
- Configure individual student practicum-hour targets.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 18, Vite 6, JavaScript |
| Styling | Tailwind CSS, Custom CSS |
| UI Libraries | Lucide React, Framer Motion, Recharts |
| Backend | Node.js, Express 5 |
| Database | MongoDB Atlas, Mongoose |
| Authentication | JWT, bcryptjs |
| Frontend Hosting | Netlify |
| Backend Hosting | Render |
| Version Control | Git and GitHub |
| Testing | Vitest, React Testing Library, Supertest |
| CI/CD | GitHub Actions |

## System Architecture

```text
                  USER
                   |
                   v
           NETLIFY FRONTEND
             React + Vite
                   |
                   | HTTPS / REST API
                   v
            RENDER BACKEND
            Node.js + Express
                   |
                   | Mongoose
                   v
             MONGODB ATLAS
                   |
              User Accounts
             Attendance Logs
                 Schedules
                Evaluations
            Adjustment Requests
```

The frontend communicates with the backend through REST APIs. User authentication uses JWT, while role-based authorization restricts access to protected features.

## Project Structure

```text
Practrack/
|
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- components/
|   |   |-- context/
|   |   |-- hooks/
|   |   |-- pages/
|   |   |-- routes/
|   |   |-- api/
|   |   `-- utils/
|   |-- package.json
|   `-- .env.example
|
|-- backend/
|   |-- src/
|   |-- scripts/
|   |-- tests/
|   |-- server.js
|   |-- app.js
|   |-- package.json
|   `-- .env.example
|
|-- docs/
|-- .github/workflows/
`-- README.md
```

## Local Installation

### Requirements

- Node.js 22 or newer
- npm
- Git
- MongoDB database (local or Atlas)

### 1. Clone the Repository

```bash
git clone https://github.com/kimilouie3000/Practrack.git
cd Practrack
```

### 2. Backend Setup

```bash
cd backend
npm ci
```

Create a `.env` file inside `backend/`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/practrack_dev
JWT_SECRET=REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
CLIENT_URL=http://localhost:5173
REQUIRED_HOURS=400
PRACTICUM_TIME_ZONE=Asia/Manila
```

Replace the example values with your own configuration.

Start the backend:

```bash
npm run dev
```

Backend URL:

http://localhost:5000

### 3. Frontend Setup

Open another terminal from the repository root:

```bash
cd frontend
npm ci
```

Create a `.env` file:

```env
VITE_API_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

Open:

http://localhost:5173

Both frontend and backend must be running for local development.

## Administrator Account Setup

Configure these variables in `backend/.env`:

```env
ADMIN_NAME=PracTrack Administrator
ADMIN_EMAIL=admin@practrack.com
ADMIN_PASSWORD=REPLACE_WITH_A_NEW_SECURE_PASSWORD
```

Create or update the Administrator account:

```bash
cd backend
npm run seed:admin
```

The password must contain at least 12 characters.

**Important:** The seed script writes to the database selected by `MONGODB_URI`. Verify the database before running it, especially when working with Production.

## Environment Variables

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DATABASE` | Explicit backend database selection |
| `JWT_SECRET` | JWT authentication secret |
| `CLIENT_URL` | Allowed frontend origin for CORS |
| `VITE_API_URL` | Frontend API base URL |
| `PORT` | Backend listening port |
| `NODE_ENV` | Development or production mode |
| `REQUIRED_HOURS` | Default practicum-hour requirement |
| `MAX_CREDITED_HOURS_PER_RECORD` | Maximum credited hours per record |
| `PRACTICUM_TIME_ZONE` | Time zone for attendance dates |

The default practicum requirement is **400 hours** unless configured otherwise. Administrators can also set individual student targets.

## Production Deployment

### Frontend — Netlify

Production branch: `main`

```env
VITE_API_URL=https://practrack.onrender.com
```

Netlify builds the frontend using Vite. Environment-variable changes require a new frontend build.

### Backend — Render

Production branch: `main`

Important configuration:

```env
NODE_ENV=production
CLIENT_URL=https://practrack.netlify.app
MONGODB_DATABASE=practrack
```

Additional required secrets, including `MONGODB_URI` and `JWT_SECRET`, are configured privately in Render.

### Database — MongoDB Atlas

The project uses separate databases:

| Environment | Database |
|---|---|
| Production | `practrack` |
| Staging | `practrack_staging` |

Production and staging data are independent. Creating accounts in one environment does not automatically create them in the other.

Use separate database credentials with restricted access whenever possible.

## API Overview

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Verify backend availability |
| `POST /api/auth/register` | Register a student |
| `POST /api/auth/login` | Authenticate a user |
| `GET /api/auth/me` | Retrieve authenticated user |
| `POST /api/auth/change-password` | Change account password |
| `/api/profile` | Manage profile information |
| `/api/logs` | Manage attendance records |
| `/api/schedule` | Access scheduling features |
| `/api/admin` | Administrator operations |
| `/api/teacher` | Teacher operations |
| `/api/client` | Client operations |

Protected endpoints require a valid JWT and the appropriate user role.

## Authentication and Security

PracTrack includes:

- JWT-based authentication.
- bcrypt password hashing.
- Role-based access control.
- Account activation and deactivation.
- Login rate limiting and temporary account lockout.
- Environment-based CORS restrictions.
- Server-side input validation.
- Account password reset and change-password functionality.

New account identifiers use the `@practrack.com` domain. New passwords must be 12–128 characters.

Never commit `.env` files, database passwords, JWT secrets, or real account credentials to GitHub. Rotate credentials immediately if exposed.

## Testing

### Backend Tests

```bash
cd backend
npm ci
npm test
```

### Frontend Tests

```bash
cd frontend
npm ci
npm test
```

### Production Build

```bash
cd frontend
npm run build
```

Automated testing covers application logic, frontend behavior, backend endpoints, and authorization rules.

## CI/CD Workflow

GitHub Actions runs automated checks when changes are pushed to `main` or a pull request targets `main`.

```text
Code Changes
     |
     v
GitHub Repository
     |
     v
GitHub Actions
     |
     +-- Backend Tests
     |
     +-- Frontend Tests
     |
     +-- Frontend Build
     |
     v
Pull Request / Merge
     |
     +-- Netlify Deployment
     |
     +-- Render Deployment
```

Deployment depends on the hosting services' configured GitHub branches and publishing settings.

Workflow: `.github/workflows/ci.yml`

## Troubleshooting

| Problem | Check |
|---|---|
| Failed to fetch | API URL, backend availability, CORS |
| Incorrect email/password | Account, password, database selection |
| MongoDB authentication failed | Database username and password |
| MongoDB connection refused | Atlas IP access list and URI |
| Wrong database records | `MONGODB_DATABASE` and `MONGODB_URI` |
| Old interface after deployment | Deployed Git branch and Netlify build |
| Unauthorized access | JWT validity and user permissions |

## Project Information

**Project:** PracTrack — Practicum Hours & Verification System

**Course:** IPT 102 — Integrative Programming and Technologies 2

**Repository:** [kimilouie3000/Practrack](https://github.com/kimilouie3000/Practrack)

**Project Status:** Deployed, with ongoing functional testing and improvements.

---

PracTrack aims to provide an organized, reliable, and efficient approach to practicum monitoring, attendance verification, and student progress management.
