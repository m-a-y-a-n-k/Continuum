# Continuum 🚀

**Continuum** is a high-performance, multi-tenant SaaS CDN (Content Delivery Network) platform designed to provide secure, scalable, and efficient content delivery for modern web applications.

## ✨ Features

- 🌐 **Multi-Tenant Architecture**: Manage multiple domains and origins from a single Continuum instance.
- 🛡️ **Web Application Firewall (WAF)**: Built-in protection against common web threats.
- 🔐 **Advanced Authentication**: Secure Admin Access with Email OTP and Google SSO integration.
- 📊 **Real-time Analytics**: Comprehensive dashboard showing traffic, bandwidth, and cache hit rates.
- 🚀 **High Performance Caching**: intelligent caching with TTL support and manual purge capabilities.
- 📈 **Scalability**: Native Node.js clustering support and Redis integration for distributed state.
- 🐳 **Docker Ready**: Easily deployable using Docker and Docker Compose.

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Persistence/State**: Redis (via ioredis)
- **Authentication**: Google Auth Library, Nodemailer (for OTP)
- **Deployment**: Docker, Docker Compose
- **Testing**: Jest

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- Redis (optional, but recommended for production)
- Docker (optional, for containerized deployment)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Continuum
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables (optional):
   Create a `.env` file in the root directory to override default configurations.

### Running Locally

To start the Continuum server:
```bash
npm start
```
The server will start on `http://localhost:5000` (by default).

### Running with Docker

Use Docker Compose to spin up Continuum along with Redis:
```bash
docker-compose up -d
```

## 📖 Usage

### Accessing the Platform

- **Landing Page**: `http://localhost:5000/`
- **Public Stats**: `http://localhost:5000/cdn-dashboard`
- **Admin Control Center**: `http://localhost:5000/admin-dashboard` (Requires authentication)

### Admin API

Continuum provides a set of admin APIs for domain management:

- **List Domains**: `GET /admin/domains`
- **Add Domain**: `POST /admin/domains`
  ```json
  {
    "hostname": "example.com",
    "origin": "https://origin.example.com"
  }
  ```
- **Remove Domain**: `DELETE /admin/domains`
  ```json
  {
    "hostname": "example.com"
  }
  ```

### Cache Purging

Purge specific paths or entire domains:
`GET /cdn-purge?domain=example.com&path=/static/app.js`

## 🧪 Testing

Run the test suite using Jest:
```bash
npm test
```

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.
