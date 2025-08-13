# Heroku Deployment Guide

This guide will walk you through deploying your PDF Editor Svelte application to Heroku using the modern `heroku.yml` build manifest.

## Prerequisites

1. **Heroku Account**: Sign up at [heroku.com](https://heroku.com)
2. **Heroku CLI**: Install from [devcenter.heroku.com/articles/heroku-cli](https://devcenter.heroku.com/articles/heroku-cli)
3. **Git**: Ensure your project is in a Git repository

## Configuration Files

Your project now includes:
- **`heroku.yml`**: Build manifest that tells Heroku how to build and run your app
- **`server.js`**: Express server to serve your built Svelte application
- **`Procfile`**: Tells Heroku to run `npm start`
- **`package.json`**: Updated with all necessary dependencies and scripts

## Deployment Steps

### 1. Login to Heroku CLI
```bash
heroku login
```

### 2. Create a new Heroku app
```bash
heroku create your-app-name
```
Replace `your-app-name` with your desired app name (must be unique across all of Heroku).

### 3. Add Heroku remote to your Git repository
```bash
heroku git:remote -a your-app-name
```

### 4. Commit your changes
```bash
git add .
git commit -m "Prepare for Heroku deployment with heroku.yml"
```

### 5. Deploy to Heroku
```bash
git push heroku main
```
Note: If your default branch is `master`, use `git push heroku master` instead.

### 6. Open your deployed application
```bash
heroku open
```

## How heroku.yml Works

The `heroku.yml` file configures the build process:

```yaml
build:
  languages:
    - nodejs
  config:
    NPM_CONFIG_PRODUCTION: false
    NODE_ENV: development

release:
  command:
    - npm run build
  image: web

run:
  web: npm start
```

**Build Phase**: 
- Uses Node.js buildpack
- Installs all dependencies (including dev dependencies needed for building)
- Runs `npm run build` to create production files

**Release Phase**:
- Executes build commands
- Prepares the application for deployment

**Run Phase**:
- Starts the application with `npm start`

## What Happens During Deployment

1. **Build Process**: Heroku reads `heroku.yml` and uses the Node.js buildpack
2. **Dependency Installation**: All dependencies are installed (including build tools)
3. **Build Command**: `npm run build` creates production files in `public/build/`
4. **Release**: Build artifacts are prepared
5. **Start Command**: Heroku runs `npm start` which starts the Express server

## Development vs Production

- **Development**: Server runs on port 3000 (configurable in `server.js`)
- **Production**: Heroku automatically assigns a port via `process.env.PORT`
- **Local Testing**: Access at `http://localhost:3000` during development

## Troubleshooting

### Build Errors
If you encounter build errors:
```bash
heroku logs --tail
```
This will show you real-time logs during deployment.

### Port Issues
The application automatically uses Heroku's `PORT` environment variable, so no manual configuration is needed.

### Static File Issues
Ensure your `public` directory contains the built files. The build process should create:
- `public/build/bundle.js`
- `public/build/bundle.css`

### Manual Build on Heroku
If needed, you can manually trigger a build:
```bash
heroku run npm run build
```

## Updating Your Application

To deploy updates:
1. Make your changes
2. Commit to Git: `git commit -m "Update description"`
3. Push to Heroku: `git push heroku main`

## Environment Variables

If you need to add environment variables:
```bash
heroku config:set VARIABLE_NAME=value
```

## Monitoring

- **View logs**: `heroku logs --tail`
- **Check app status**: `heroku ps`
- **Restart app**: `heroku restart`

## Cost Considerations

- **Free Tier**: No longer available on Heroku
- **Basic Dyno**: Starts at $7/month
- **Eco Dyno**: Starts at $5/month (sleeps after 30 minutes of inactivity)

## Alternative Deployment Options

If Heroku doesn't meet your needs, consider:
- **Vercel**: Great for static sites, free tier available
- **Netlify**: Excellent for static sites, generous free tier
- **Railway**: Modern alternative to Heroku
- **Render**: Good free tier, easy deployment

## Support

For Heroku-specific issues, check:
- [Heroku Dev Center](https://devcenter.heroku.com/)
- [Heroku Support](https://help.heroku.com/)
- [heroku.yml Documentation](https://devcenter.heroku.com/articles/build-docker-images-heroku-yml)
