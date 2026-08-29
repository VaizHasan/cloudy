# Cloudy

Secure, modern file storage and sharing platform built with Next.js, PostgreSQL, Prisma, and Backblaze B2.

Cloudy is a full-stack cloud storage application for securely uploading, organizing, managing, downloading, and sharing files through a responsive web workspace.

The application uses direct-to-object-storage uploads through presigned URLs, keeping large file transfers away from the application server while PostgreSQL handles application data, authentication, file metadata, folders, and sharing.

## Overview

Cloudy provides a private-by-default storage experience with user authentication, file and folder management, storage quotas, secure sharing, and direct browser-to-object-storage uploads.

The architecture separates application logic from file storage:

* Next.js handles the frontend and server-side API logic.
* PostgreSQL stores application data and metadata.
* Prisma provides database access.
* Backblaze B2 stores file objects.
* Presigned URLs allow clients to upload and download files without exposing storage credentials.
* Vercel hosts the application.

## Features

### File Management

* Upload files directly to Backblaze B2
* Support files up to 1 GB per file
* Multiple-file upload support
* File metadata management
* Secure file downloads
* Signed download URLs
* File deletion
* Permanent deletion of stored object versions
* File search
* File sorting
* File filtering
* File size tracking
* Storage usage tracking

### Folder Management

* Create folders
* Rename folders
* Delete folders
* Organize files into folders
* Move files between folders
* Folder ownership validation
* Drag-and-drop file organization

### File Sharing

* Generate secure file-sharing links
* Public share pages
* Controlled access to shared files
* Time-limited signed download URLs
* Storage credentials remain hidden from users

### Authentication and Security

* User registration
* User login
* User logout
* Cookie-based sessions
* Server-side session verification
* Protected API routes
* User ownership validation
* Private object storage
* Storage quota enforcement
* Atomic storage reservation
* Presigned object-storage URLs
* Environment-based secret management

### Dashboard

* Storage usage overview
* Recent files
* Favorites
* Shared files
* Trash
* Settings
* Folder navigation
* Responsive workspace interface

## Architecture

```text
                         Cloudy
                           |
                           v
                +----------------------+
                |      Next.js App     |
                | React + App Router   |
                +----------+-----------+
                           |
                           | HTTPS
                           v
                +----------------------+
                |   Next.js Route      |
                |      Handlers        |
                +----------+-----------+
                           |
              +------------+------------+
              |                         |
              |                         |
              v                         v
     +----------------+        +----------------+
     |   PostgreSQL   |        |  Backblaze B2  |
     |                |        | Object Storage |
     | Users          |        |                |
     | Sessions       |        | Private Bucket |
     | Files          |        |                |
     | Folders        |        | S3-Compatible  |
     | Shares         |        | API            |
     +----------------+        +----------------+
                                      ^
                                      |
                               Presigned URLs
                                      |
                                      |
                               +------+------+
                               |   Browser   |
                               |             |
                               | Direct File |
                               |   Upload    |
                               +-------------+
```

## Upload Architecture

Cloudy does not send the actual file payload through the Next.js application server.

Instead, uploads follow this flow:

```text
Browser
   |
   | 1. File metadata
   v
POST /api/upload/initiate
   |
   +-- Authenticate user
   |
   +-- Validate file information
   |
   +-- Validate folder ownership
   |
   +-- Check storage quota
   |
   +-- Reserve storage atomically
   |
   +-- Generate storage key
   |
   +-- Generate presigned upload URL
   |
   v
Browser
   |
   | 2. Direct upload
   v
Backblaze B2
   |
   | 3. Upload completed
   v
POST /api/upload/complete
   |
   +-- Verify uploaded object
   |
   +-- Create file database record
   |
   +-- Finalize upload
```

This architecture reduces application-server bandwidth usage and allows Backblaze B2 to handle the actual file transfer.

## Technology Stack

### Frontend

* Next.js 16
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Lucide Icons

### Backend

* Next.js App Router
* Route Handlers
* TypeScript
* Server-side authentication
* REST-style API endpoints

### Database

* PostgreSQL
* Prisma ORM

### Object Storage

* Backblaze B2
* S3-compatible API
* AWS SDK for JavaScript
* Presigned URLs

### Infrastructure

* Vercel
* Neon PostgreSQL
* Backblaze B2

## Project Structure

```text
cloudy/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   ├── files/
│   │   ├── folders/
│   │   ├── share/
│   │   ├── storage/
│   │   └── upload/
│   │
│   ├── dashboard/
│   │   ├── favorites/
│   │   ├── settings/
│   │   ├── shared/
│   │   └── trash/
│   │
│   ├── login/
│   ├── signup/
│   └── share/
│
├── components/
│   └── ...
│
├── generated/
│   └── prisma/
│
├── lib/
│   ├── auth/
│   ├── storage/
│   ├── db.ts
│   └── ...
│
├── prisma/
│   └── schema.prisma
│
├── public/
│   └── ...
│
├── cors.json
├── next.config.ts
├── package.json
├── prisma.config.ts
└── README.md
```

## Security Model

Cloudy follows a private-by-default storage model.

### Application Secrets

Sensitive credentials are provided through environment variables and are never intended to be committed to source control.

Required configuration includes:

```text
DATABASE_URL
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
S3_BUCKET
S3_ENDPOINT
```

The actual values must never be included in the repository.

### Private Object Storage

The Backblaze B2 bucket is configured as private.

The browser does not receive permanent Backblaze credentials. Instead, the server generates short-lived presigned URLs for permitted upload and download operations.

### Authentication

Protected operations require a valid authenticated session.

The server verifies the session before allowing operations such as:

* Uploading files
* Accessing private files
* Creating shares
* Managing folders
* Deleting files
* Modifying user-owned resources

### Authorization

Resource ownership is validated server-side.

For example, folder operations verify that the requested folder belongs to the authenticated user before allowing the operation.

### Storage Quotas

Before an upload is initialized, Cloudy validates the requested file size against the user's remaining storage capacity.

Storage is reserved atomically to reduce race conditions when multiple uploads occur concurrently.

## Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="your-postgresql-connection-string"

AWS_ACCESS_KEY_ID="your-backblaze-application-key-id"
AWS_SECRET_ACCESS_KEY="your-backblaze-application-key"

AWS_REGION="your-b2-s3-region"
S3_BUCKET="your-bucket-name"
S3_ENDPOINT="https://s3.your-region.backblazeb2.com"
```

Never commit `.env`, `.env.local`, or other files containing credentials.

For Vercel deployments, configure the same environment variables in the project's Environment Variables settings.

## Getting Started

### Prerequisites

Before running Cloudy locally, make sure you have:

* Node.js
* npm
* PostgreSQL
* A Backblaze B2 account
* A Backblaze B2 bucket
* A Backblaze application key with the required permissions

### 1. Clone the Repository

```bash
git clone https://github.com/VaizHasan/cloudy.git
cd cloudy
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root and configure the required variables.

```env
DATABASE_URL="your-postgresql-connection-string"

AWS_ACCESS_KEY_ID="your-backblaze-application-key-id"
AWS_SECRET_ACCESS_KEY="your-backblaze-application-key"

AWS_REGION="your-b2-s3-region"
S3_BUCKET="your-bucket-name"
S3_ENDPOINT="https://s3.your-region.backblazeb2.com"
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Apply Database Migrations

For local development:

```bash
npx prisma migrate dev
```

### 6. Start the Development Server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

## Production Build

Before deploying, verify that the application builds successfully:

```bash
npm run build
```

To run the production build locally:

```bash
npm start
```

## Deployment

Cloudy is designed to be deployed using Vercel.

### Deployment Architecture

```text
                         Vercel
                           |
                           |
                    +------+------+
                    |             |
                    v             v
               Next.js App    API Routes
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
              PostgreSQL                  Backblaze B2
                 / Neon                   Object Storage
```

### Vercel Environment Variables

Configure the following variables in the Vercel project:

```text
DATABASE_URL
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
S3_BUCKET
S3_ENDPOINT
```

After changing environment variables, create a new deployment so the updated configuration is applied.

## Backblaze B2 CORS

Because Cloudy performs direct browser-to-B2 uploads using presigned URLs, the B2 bucket must allow the application's deployed origin.

Example:

```json
[
  {
    "corsRuleName": "cloudy-production",
    "allowedOrigins": [
      "http://localhost:3000",
      "https://your-production-domain.vercel.app"
    ],
    "allowedOperations": [
      "s3_put",
      "s3_get",
      "s3_head"
    ],
    "allowedHeaders": [
      "*"
    ],
    "exposeHeaders": [
      "ETag"
    ],
    "maxAgeSeconds": 3600
  }
]
```

The `allowedOrigins` values must contain origins only.

For example:

```text
https://your-production-domain.vercel.app
```

Do not include paths such as:

```text
https://your-production-domain.vercel.app/login
```

If the deployed application domain changes, the new origin must also be added to the B2 CORS configuration.

## API Overview

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Files

```text
GET    /api/files
GET    /api/files/[id]
DELETE /api/files/[id]
GET    /api/files/[id]/download
POST   /api/files/[id]/share
DELETE /api/files/delete-all
```

### Folders

```text
GET    /api/folders
POST   /api/folders
PATCH  /api/folders/[id]
DELETE /api/folders/[id]
```

### Uploads

```text
POST /api/upload/initiate
POST /api/upload/complete
POST /api/upload/abort
```

### Sharing

```text
GET /api/share/[token]
GET /share/[token]
```

## Configuration Limits

| Resource                |      Limit |
| ----------------------- | ---------: |
| Maximum file size       |       1 GB |
| Default storage quota   |      10 GB |
| Upload URL expiration   | 10 minutes |
| Download URL expiration | 10 minutes |

These values are application-level configuration and may change as the project evolves.

## Data Integrity

Cloudy uses database-backed metadata and object-storage verification to keep application records synchronized with stored files.

During upload initialization:

1. The user's authentication is verified.
2. The file metadata is validated.
3. Folder ownership is checked.
4. Available storage is calculated.
5. Storage is atomically reserved.
6. A unique object-storage key is generated.
7. A presigned upload URL is returned.

After the upload:

1. The uploaded object is verified.
2. File metadata is persisted.
3. The upload is finalized.

This approach helps prevent unauthorized access and reduces inconsistencies caused by concurrent uploads.

## Roadmap

Future improvements may include:

* [ ] Resumable multipart uploads
* [ ] Improved upload progress handling
* [ ] File previews
* [ ] Image thumbnails
* [ ] Advanced search
* [ ] Expiring share links
* [ ] Password-protected share links
* [ ] File version history interface
* [ ] Activity and audit logs
* [ ] Two-factor authentication
* [ ] Storage analytics
* [ ] Administrative dashboard
* [ ] Automated cleanup of abandoned upload reservations

## Development Notes

Cloudy is structured to keep infrastructure credentials and server-side operations separate from browser-side code.

The browser should never receive:

* Database credentials
* Backblaze application keys
* Backblaze secret keys
* Other server-side environment secrets

Only temporary signed URLs generated by the server should be exposed to the client for authorized object-storage operations.

## Author

**Vaiz Hasan**

Software Engineer focused on full-stack development, AI/ML, and modern web technologies.

GitHub: https://github.com/VaizHasan

Repository: https://github.com/VaizHasan/cloudy

## License

This project is currently maintained as a personal software project.

License terms can be added when the project is prepared for public distribution.

---

<p align="center">
  Built with Next.js, PostgreSQL, Prisma, and Backblaze B2.
</p>
