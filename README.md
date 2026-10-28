# 🎮 Gaming Hub — Multi-Café Management Platform

**One platform. Multiple gaming cafés. Smarter operations.**

Gaming Hub is a full-stack web platform designed to simplify gaming café operations through centralized café discovery, session management, controller-based billing, and payment tracking.

Built with the MERN stack, the platform is designed to support multiple gaming cafés while maintaining role-based access control and café-level data isolation.

<p align="center">
  <b>Full-Stack Development · Multi-Tenant Architecture · Authentication · Business Logic · Docker</b>
</p>

---

## 🚀 The Problem

Gaming cafés often rely on manual processes to manage station availability, customer sessions, gaming duration, and payments. These workflows can lead to billing errors, poor visibility, and difficulty managing operations as a café grows.

**Gaming Hub aims to bring these operations into one centralized platform.**

## ✨ Key Features

### 🌐 Global Café Discovery
- Browse publicly listed gaming cafés from a central landing page.
- Access individual cafés through unique, shareable URLs.
- Support direct café entry through QR-code links where configured.

### 🔐 Authentication & Authorization
- Separate customer and administrative authentication flows.
- JWT-based authentication and bcrypt password hashing.
- Role-based access for owners, managers, staff, and customers.
- Protected routes and backend authorization.
- Designed to prevent cross-café data access.

### 🕹️ Gaming Session Management
- View available gaming stations.
- Submit session requests with a selected controller count.
- Allow staff to approve or reject requests.
- Track session start time, duration, and estimated charges.
- Keep session termination under staff control.

### 💰 Time-Based Billing
Billing is based on the number of controllers and actual session duration.

**Pricing: ₹100 per controller per hour**

```text
Bill = (Rate × Controllers × Duration in minutes) / 60
```

For example, two controllers used for 30 minutes cost ₹100.

### 🧾 Payment & Records
- Record payments against gaming sessions.
- Track payment status and session history.
- Support manual sessions for walk-in customers where implemented.
- Export payment records to Excel where available.

### 🏪 Café Operations
- Café-specific dashboards.
- Station and session management.
- Controller-count editing before session approval.
- Administrative control over session completion.
- Café-level data isolation enforced by backend authorization.

---

## 🧠 Engineering Highlights

Gaming Hub is more than a basic CRUD application. Its key engineering challenges include:

- **Multi-tenancy:** Structuring access so multiple cafés can use one platform without exposing each other's private data.
- **Role-based access control:** Enforcing permissions across customer, staff, manager, and owner workflows.
- **Session lifecycle management:** Handling transitions from request to active session, payment pending, and completion.
- **Time-based billing:** Calculating charges using controller count and actual elapsed time.
- **Authentication isolation:** Keeping customer and administrative identities separate across frontend state, API requests, and protected routes.
- **Production deployment:** Preparing the application for containerized deployment with environment-based configuration.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React 19 | Frontend UI |
| Vite | Development and production builds |
| React Router | Client-side routing |
| Axios | API communication |
| Node.js | Backend runtime |
| Express.js | REST API |
| MongoDB | Data persistence |
| Mongoose | Schema modeling and database operations |
| JWT | Authentication |
| bcrypt | Password hashing |
| express-validator | Request validation |
| Helmet | HTTP security headers |
| CORS | Cross-origin access configuration |
| express-rate-limit | API rate limiting |
| Docker | Containerization |
| MongoDB Atlas | Managed database hosting |
| AWS EC2 | Intended cloud deployment target |

---

## 🏗️ Architecture

```text
                    ┌──────────────────┐
                    │      Users       │
                    │ Customers / Staff│
                    │ Owners / Managers│
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ React + Vite     │
                    │ Frontend         │
                    └────────┬─────────┘
                             │ HTTP / REST
                             ▼
                    ┌──────────────────┐
                    │ Node.js + Express│
                    │ API & Middleware │
                    └────────┬─────────┘
                             │
                 ┌───────────┼───────────┐
                 ▼           ▼           ▼
           Authentication  Cafés &     Sessions &
           & Authorization Stations     Payments
                 │           │           │
                 └───────────┼───────────┘
                             ▼
                    ┌──────────────────┐
                    │ MongoDB Atlas    │
                    │ Data Persistence │
                    └──────────────────┘
```

The application is designed so that frontend requests pass through backend validation and authorization before accessing café, station, session, or payment data.

The production setup can serve the built frontend through Express, with Docker used to package the application.

---

## 🔄 How It Works

1. A customer opens Gaming Hub and browses the café listing.
2. The customer selects a café and opens its public page.
3. The customer explicitly signs in or registers when required.
4. The customer selects an available station and controller count.
5. A session request is sent to the café.
6. Staff approves or rejects the request.
7. On approval, the backend records the session start time.
8. The customer views the session duration and estimated bill.
9. Staff ends the session, moving it to payment pending.
10. The customer pays at the counter and staff records the payment.
11. The session is completed and the station becomes available.

---

## 🔒 Security Considerations

- Passwords are hashed instead of stored as plaintext.
- JWTs are used to authenticate protected requests.
- Privileged operations require backend authorization.
- Café access must be scoped to the user's authorized café.
- Billing totals should be calculated and validated server-side.
- Secrets and database credentials must be provided through environment variables.
- Security middleware and API rate limiting help protect the backend.

Security controls should be verified against the current implementation before claiming production readiness.

---

## ⚙️ Local Development

### Prerequisites

- Node.js and npm
- MongoDB or a MongoDB Atlas connection
- Git
- Docker, if running the containerized backend

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd <YOUR_PROJECT_DIRECTORY>
```

### 2. Configure environment variables

Create the required backend `.env` file using the variables expected by the existing configuration.

Typical examples may include:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_strong_secret
JWT_EXPIRES_IN=your_token_expiry
```

Use the exact variable names required by the codebase. Never commit real secrets.

### 3. Install dependencies

Install frontend and backend dependencies in their respective directories, following the repository's package manifests and lockfiles.

### 4. Start the application

Run the backend and frontend using the scripts defined in their respective `package.json` files.

The frontend development server and backend may use separate ports during development. In production, the current architecture can serve the built frontend through Express.

---

## 🐳 Docker

The backend is being prepared for containerized execution.

Typical Docker workflow:

```bash
docker build -t gaming-hub-backend ./server
docker run --env-file ./server/.env -p 5000:5000 gaming-hub-backend
```

Run these commands from the repository root and adjust paths if the Dockerfile or environment file is located elsewhere.

The container must receive valid runtime configuration and be able to reach MongoDB Atlas. A successful image build alone does not prove that the application is production-ready.

---

## ☁️ Deployment

The intended deployment approach includes:

- Docker for packaging the backend.
- AWS EC2 as the application host.
- MongoDB Atlas for managed database storage.
- Environment-based production configuration.
- Production frontend assets served through Express.

A production rollout should also verify network rules, HTTPS, domain configuration, logs, database permissions, and backup procedures.

**Deployment status:** Update this section with the actual live URL and verified deployment details once deployment is complete.

---

## 🗺️ Roadmap

Potential future improvements include:

- Real-time station and session updates.
- Online payment gateway integration.
- Automated customer notifications.
- Revenue analytics and advanced reporting.
- Customer loyalty and rewards.
- Mobile applications.
- Automated CI/CD.
- Improved monitoring, backups, and scaling.

---

## 🎯 Project Goals

Gaming Hub demonstrates practical full-stack engineering through authentication, role-based authorization, database modeling, session state management, business-rule implementation, and containerized deployment.

The long-term goal is to provide gaming cafés with a unified platform for managing their daily operations while giving customers a simpler way to discover cafés and access gaming sessions.

---
[Live Demo Link](https://gaminghub-5qac.onrender.com/) 

## 👨‍💻 Author

**Ritik Patil**

Full-Stack Developer | MERN Stack | Backend Engineering | Cloud & DevOps

[GitHub](https://github.com/Ritik-56) · [LinkedIn](https://www.linkedin.com/in/ritik-patil-542660245/)

---

<p align="center">
  <i>Built to make gaming café operations simpler, smarter, and more scalable.</i>
</p>
