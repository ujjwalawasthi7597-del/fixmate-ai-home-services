# FixMate 🛠️
### AI-Powered Home Services & Repair Management Platform

<p align="center">
  <b>One Platform. Every Home Service. Smarter Repairs.</b>
</p>

<p align="center">
  <a href="https://fixmate-4278.ai.studio">🌐 Live Demo</a>
</p>

---

## 📌 About The Project

**FixMate** is an AI-powered home services and repair management platform designed to make finding, booking, and managing home repair services easier.

From plumbing and electrical repairs to appliance maintenance, FixMate connects customers with service professionals through a streamlined booking experience.

The platform also includes an AI-powered repair assistant that helps users understand common household problems and find suitable solutions.

## 🌐 Live Demo

**Try FixMate:** https://fixmate-4278.ai.studio

---

## ✨ Key Features

### 👤 User Authentication & Role Management
- Secure user registration and login.
- JWT-based authentication.
- Role-based access for Customers, Service Providers, and Admins.
- Password hashing using bcrypt.

### 🏠 Customer Dashboard
- Explore available home services.
- Book services based on requirements.
- Track booking status and service progress.
- View booking history.
- Review service quotations.
- Approve or reject quotations.

### 🔧 Service Provider Management
- Dedicated service provider profiles.
- Manage service availability.
- Receive and manage service requests.
- Submit quotations for customer approval.
- Track assigned jobs and bookings.

### 🤖 AI Repair Assistant
- AI-powered assistance for household repair queries.
- Helps users understand common home maintenance problems.
- Provides preliminary troubleshooting suggestions.
- Powered by Google Gemini API.

### 💳 Payment Integration
- Razorpay payment gateway integration.
- Test-mode payment processing.
- Payment status management.
- Secure backend payment verification.

### 🛡️ Admin Dashboard
- Manage customers and service providers.
- Monitor service bookings.
- Manage platform activities.
- Track service requests and operations.

### 📍 Location & Image Support
- Location-based service experience.
- OpenStreetMap and Leaflet map integration.
- Cloudinary-based image upload and management.

---

## 🧰 Tech Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, TypeScript |
| Styling | Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcrypt |
| AI Integration | Google Gemini API |
| Payments | Razorpay |
| Image Storage | Cloudinary |
| Maps | OpenStreetMap, Leaflet |
| API Communication | REST APIs |
| Version Control | Git, GitHub |

---

## 🏗️ Application Architecture

```text
                 ┌─────────────────────┐
                 │     React Frontend  │
                 │  TypeScript +       │
                 │  Tailwind CSS       │
                 └──────────┬──────────┘
                            │
                         REST APIs
                            │
                 ┌──────────▼──────────┐
                 │   Node.js Backend  │
                 │   Express.js       │
                 └──────────┬──────────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
       ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
       │ MongoDB   │  │ Gemini AI │  │ Razorpay  │
       │ Database  │  │ Assistant │  │ Payments  │
       └───────────┘  └───────────┘  └───────────┘
                            │
                     ┌──────▼──────┐
                     │ Cloudinary  │
                     │ Image Store │
                     └─────────────┘
```

---

## ⚙️ Getting Started

Follow these steps to run FixMate locally.

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/fixmate-ai-home-services.git
```

### 2. Navigate to the Project

```bash
cd fixmate-ai-home-services
```

### 3. Install Dependencies

Install dependencies in the frontend and backend directories according to the project's folder structure.

```bash
npm install
```

### 4. Configure Environment Variables

Create the required `.env` file in the appropriate backend/frontend directories.

Example environment configuration:

```env
# Database
MONGODB_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=your_secure_jwt_secret

# AI Integration
GEMINI_API_KEY=your_gemini_api_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Razorpay - Test Mode
RAZORPAY_KEY_ID=your_test_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Application
FRONTEND_URL=your_frontend_url
NODE_ENV=development
```

**Note:** Use your actual environment variable names and configure each variable in the appropriate application environment. Never commit real credentials or `.env` files to GitHub.

### 5. Run the Application

Use the development scripts defined in the frontend and backend `package.json` files.

For example:

```bash
npm run dev
```

---

## 🔐 Security Considerations

- Passwords are hashed before storage.
- Protected APIs use JWT authentication.
- Role-based authorization controls access to protected features.
- Payment verification must be performed on the backend.
- API credentials are stored in environment variables.
- Sensitive configuration files should never be committed to version control.

---

## 🚀 Future Enhancements

- Real-time booking updates and notifications.
- Advanced service provider matching.
- Customer reviews and ratings.
- Improved AI-powered troubleshooting.
- Service analytics and reporting.
- Production payment and webhook workflows.
- Mobile application support.

---

## 🎯 Project Objective

FixMate aims to simplify home service management by bringing customers, service professionals, AI assistance, and digital payments together in one platform.

It demonstrates practical full-stack development concepts, third-party API integrations, authentication, database management, and AI-powered application development.

---

## 👨‍💻 Author

**Ujjwal Awasthi**

- GitHub: [@ujjwalawasthi7597-del](https://github.com/ujjwalawasthi7597-del)
- LinkedIn: [Ujjwal Awasthi](https://linkedin.com/in/ujjwal-awasthi-90942237b)
- LeetCode: [Ujjwal9795](https://leetcode.com/u/Ujjwal9795/)

---

<p align="center">
  <b>Built with ❤️ to make home services smarter and simpler.</b>
</p>
