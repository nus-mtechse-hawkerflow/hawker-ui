# Stage 1: Build the Angular application
FROM node:26-alpine AS build

# Set the working directory inside the container
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install project dependencies cleanly
RUN npm ci --legacy-peer-deps

# Copy the rest of your application source files
COPY . .

# Build the Angular app for production
RUN npm run build -- --configuration=production

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Remove default Nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the compiled production build from Stage 1 into Nginx's static folder
# Note: Replace 'your-app-name' with the actual output folder name found inside your dist/ directory.
COPY --from=build /app/dist/hawkerflow-ui/browser /usr/share/nginx/html

# Expose port 80 to the outside world
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]