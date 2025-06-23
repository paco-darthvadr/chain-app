# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

# The following `prisma+postgres` URL is similar to the URL produced by running a local Prisma Postgres 
# server with the `prisma dev` CLI command, when not choosing any non-default ports or settings. The API key, unlike the 
# one found in a remote Prisma Postgres URL, does not contain any sensitive information.

# For the Next.js frontend local test
#NEXT_PUBLIC_SOCKET_URL=http://192.168.0.162:3001

# For the Node.js socket server local test
#CLIENT_URL=http://192.168.0.162:3000

#NEXT_PUBLIC_APP_URL=http://192.168.0.162:3000

# Prisma DB file
DATABASE_URL="file:./prisma/dev.db"

# For public testing
NEXT_PUBLIC_APP_URL="https://04fb-82-11-152-89.ngrok-free.app"
CLIENT_URL="https://04fb-82-11-152-89.ngrok-free.app"
NEXT_PUBLIC_SOCKET_URL="wss://3043-82-11-152-89.ngrok-free.app"