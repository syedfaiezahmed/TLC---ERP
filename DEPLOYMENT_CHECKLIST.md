# 🚀 Deployment Checklist - TLC Education ERP

## Pre-Deployment Verification

### ✅ Environment Setup
- [ ] Node.js version verified (v18+ recommended)
- [ ] MongoDB connection string configured
- [ ] Environment variables set (.env files)
- [ ] JWT_SECRET configured
- [ ] MONGO_URI configured
- [ ] PORT configured (default: 5000)

### ✅ Dependencies
```bash
# Server
cd server
npm install

# Client
cd client
npm install
```

### ✅ Build Process
```bash
# Client build
cd client
npm run build

# Verify build output in /client/dist
```

### ✅ Database
- [ ] MongoDB instance running
- [ ] Database connection tested
- [ ] Initial data seeded (if required)
- [ ] Indexes created
- [ ] Backup strategy in place

### ✅ Security
- [ ] JWT_SECRET is strong and unique
- [ ] Environment variables not committed to git
- [ ] CORS configured properly
- [ ] Helmet.js enabled
- [ ] Rate limiting configured
- [ ] Input validation enabled

### ✅ Testing
- [ ] All API endpoints tested
- [ ] Authentication flow verified
- [ ] Role-based access tested
- [ ] CRUD operations verified
- [ ] File uploads tested (if applicable)
- [ ] Export functionality tested

### ✅ Performance
- [ ] Lazy loading implemented
- [ ] Code splitting verified
- [ ] Bundle size optimized
- [ ] Database queries optimized
- [ ] Caching strategy implemented

### ✅ UI/UX
- [ ] Responsive design tested (mobile, tablet, desktop)
- [ ] All forms validated
- [ ] Error messages displayed correctly
- [ ] Loading states working
- [ ] Navigation tested
- [ ] Role-based UI verified

## Deployment Steps

### 1. Server Deployment (Backend)

#### Option A: Traditional Server
```bash
# SSH into server
ssh user@your-server.com

# Clone repository
git clone <repository-url>
cd TLC/Software/server

# Install dependencies
npm install --production

# Set environment variables
nano .env
# Add: MONGO_URI, JWT_SECRET, PORT, NODE_ENV=production

# Start with PM2
npm install -g pm2
pm2 start src/index.js --name tlc-erp-api
pm2 save
pm2 startup
```

#### Option B: Vercel (Serverless)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from server directory
cd server
vercel --prod
```

### 2. Client Deployment (Frontend)

#### Option A: Vercel
```bash
cd client
vercel --prod
```

#### Option B: Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

cd client
npm run build
netlify deploy --prod --dir=dist
```

#### Option C: Traditional Server (Nginx)
```bash
# Build
cd client
npm run build

# Copy to server
scp -r dist/* user@server:/var/www/tlc-erp/

# Nginx config
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/tlc-erp;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Database Setup

```bash
# MongoDB Atlas (Recommended)
1. Create cluster at mongodb.com/cloud/atlas
2. Create database user
3. Whitelist IP addresses
4. Get connection string
5. Update MONGO_URI in .env

# Or Local MongoDB
mongod --dbpath /data/db
```

### 4. SSL Certificate (HTTPS)

```bash
# Using Certbot (Let's Encrypt)
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
sudo certbot renew --dry-run
```

## Post-Deployment

### ✅ Verification
- [ ] Website accessible via domain
- [ ] HTTPS working
- [ ] Login functionality working
- [ ] All roles accessible
- [ ] Database operations working
- [ ] File uploads working (if applicable)
- [ ] Email notifications working (if configured)

### ✅ Monitoring
- [ ] Error logging configured
- [ ] Performance monitoring setup
- [ ] Uptime monitoring enabled
- [ ] Database backups automated
- [ ] Analytics configured (optional)

### ✅ Documentation
- [ ] User manual created
- [ ] Admin guide created
- [ ] API documentation available
- [ ] Deployment notes documented

## Environment Variables Reference

### Server (.env)
```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/tlc-erp
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
ENABLE_BACKUP_SCHEDULER=true
```

### Client (.env)
```env
VITE_API_URL=https://api.your-domain.com
```

## Backup Strategy

### Database Backup
```bash
# Daily automated backup
0 2 * * * mongodump --uri="$MONGO_URI" --out=/backups/$(date +\%Y\%m\%d)

# Retention: Keep last 30 days
find /backups -type d -mtime +30 -exec rm -rf {} \;
```

### Application Backup
```bash
# Code repository: Git
# Files: Regular backups to cloud storage
# Database: Automated daily backups
```

## Rollback Plan

### If Deployment Fails
```bash
# Revert to previous version
pm2 stop tlc-erp-api
git checkout <previous-commit>
npm install
pm2 restart tlc-erp-api

# Or restore from backup
mongorestore --uri="$MONGO_URI" /backups/latest
```

## Performance Optimization

### Server
- [ ] Enable compression
- [ ] Configure caching headers
- [ ] Use CDN for static assets
- [ ] Enable gzip compression
- [ ] Optimize database queries

### Client
- [ ] Minify assets
- [ ] Optimize images
- [ ] Enable lazy loading
- [ ] Use code splitting
- [ ] Configure service worker (PWA)

## Security Hardening

### Server
- [ ] Update all dependencies
- [ ] Configure firewall
- [ ] Disable unnecessary services
- [ ] Set up fail2ban
- [ ] Regular security audits

### Application
- [ ] Implement rate limiting
- [ ] Add CSRF protection
- [ ] Sanitize all inputs
- [ ] Use prepared statements
- [ ] Regular dependency updates

## Maintenance

### Regular Tasks
- **Daily**: Monitor logs and errors
- **Weekly**: Check performance metrics
- **Monthly**: Update dependencies
- **Quarterly**: Security audit
- **Yearly**: Major version updates

### Update Process
```bash
# Test in staging first
git pull origin main
npm install
npm run build
npm test

# Deploy to production
pm2 restart tlc-erp-api
```

## Support Contacts

- **Technical Support**: support@your-domain.com
- **Emergency**: +1-XXX-XXX-XXXX
- **Documentation**: https://docs.your-domain.com

---

## Quick Commands Reference

```bash
# Start server (development)
npm run dev

# Start server (production)
npm start

# Build client
npm run build

# Check logs
pm2 logs tlc-erp-api

# Restart server
pm2 restart tlc-erp-api

# Database backup
mongodump --uri="$MONGO_URI" --out=/backups/manual

# Database restore
mongorestore --uri="$MONGO_URI" /backups/manual
```

---

**Status**: Ready for Deployment ✅  
**Last Updated**: April 2026
