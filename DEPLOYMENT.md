# Deployment Guide - StrategyWatch Trading App

## Overview
This guide covers deploying the StrategyWatch trading application to Vercel with security, performance, and reliability best practices.

## Prerequisites
- Node.js 16+ installed locally
- Vercel account
- Alpaca Markets API keys
- GitHub repository connected to Vercel

## Environment Variables

### Required Environment Variables for Vercel

1. **Alpaca API Configuration**
   ```
   VITE_ALPACA_API_KEY_ID=your_api_key_id
   VITE_ALPACA_SECRET_KEY=your_secret_key
   VITE_ALPACA_DATA_FEED=iex
   VITE_ALPACA_SANDBOX=true/false
   ```

2. **Optional Configuration**
   ```
   VITE_PERFORMANCE_MONITORING=true
   VITE_DEBUG_MODE=false
   VITE_APP_VERSION=1.0.0
   ```

### Setting Up Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings → Environment Variables**
3. Add the required variables from above
4. Ensure **VITE_ALPACA_SANDBOX=true** for initial deployment

## Deployment Process

### Automatic Deployment (Recommended)

1. **Connect Repository to Vercel**
   ```bash
   # Install Vercel CLI
   npm i -g vercel

   # Link your project
   vercel link

   # Deploy
   vercel --prod
   ```

2. **GitHub Integration**
   - Push changes to GitHub
   - Vercel will automatically deploy
   - Monitor deployment at vercel.com

### Manual Deployment

1. **Build Project Locally**
   ```bash
   cd apps/strategywatch
   npm run build:prod
   ```

2. **Deploy to Vercel**
   ```bash
   vercel --prod --prebuilt
   ```

## Security Configuration

### ✅ Security Measures Implemented

1. **API Key Protection**
   - Environment variables stored securely
   - No hardcoded credentials in code
   - `.env` files excluded from git

2. **Security Headers**
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Referrer-Policy: strict-origin-when-cross-origin

3. **Content Security**
   - Console logs removed in production
   - Error boundaries prevent crashes
   - Input validation and sanitization

## Performance Optimization

### ✅ Optimizations Applied

1. **Bundle Optimization**
   - Code splitting with manual chunks
   - Tree shaking for unused code
   - Terser minification
   - Asset compression and caching

2. **Loading Performance**
   - Lazy loading for components
   - Optimized images and assets
   - HTTP/2 server push ready
   - CDN distribution via Vercel

3. **Monitoring**
   - Performance metrics collection
   - Web Vitals tracking
   - Resource timing analysis
   - Error tracking and reporting

## Architecture for Cloud Deployment

### Monorepo Structure
```
trading-apps/
├── apps/
│   └── strategywatch/          # Main application
├── packages/
│   └── market-data/           # Shared data package
├── vercel.json                # Vercel configuration
├── .env.production            # Production template
└── DEPLOYMENT.md              # This guide
```

### Build Configuration
- **Build Command**: `npm run build`
- **Output Directory**: `apps/strategywatch/dist`
- **Node Version**: 18.x
- **Framework**: Vite + React

## Monitoring and Maintenance

### Performance Monitoring
- Automatic performance metrics collection
- Web Vitals (LCP, FID, CLS)
- Bundle size analysis
- Resource loading optimization

### Error Handling
- React Error Boundaries
- Graceful degradation
- Error logging and tracking
- User-friendly error messages

### Update Process
1. Make changes to codebase
2. Test locally: `npm run build:prod`
3. Commit changes: `git push`
4. Vercel auto-deploys to production
5. Monitor deployment status

## Troubleshooting

### Common Issues

1. **API Authentication Errors**
   - Verify environment variables in Vercel
   - Check API key validity
   - Ensure proper sandbox/production mode

2. **Build Failures**
   - Check `vercel.json` configuration
   - Verify all dependencies are installed
   - Review build logs in Vercel dashboard

3. **Performance Issues**
   - Check bundle size with `npm run build:analyze`
   - Monitor Web Vitals in browser dev tools
   - Review caching headers

### Debug Mode
Enable debug mode by setting:
```
VITE_DEBUG_MODE=true
```

## Deployment Checklist

### Pre-Deployment
- [ ] API keys configured in Vercel
- [ ] Environment variables set correctly
- [ ] Code tested locally
- [ ] Linting passes: `npm run lint`
- [ ] Build successful: `npm run build`

### Post-Deployment
- [ ] Application loads correctly
- [ ] API authentication working
- [ ] Real-time data flowing
- [ ] Performance metrics acceptable
- [ ] Error boundaries functional
- [ ] Mobile responsive design

### Security Review
- [ ] No hardcoded secrets
- [ ] Environment variables secure
- [ ] HTTPS enforced
- [ ] Security headers present
- [ ] Error handling robust

## Support and Maintenance

### Regular Maintenance Tasks
1. **Monitor API rate limits**
2. **Update dependencies monthly**
3. **Review performance metrics**
4. **Check error logs**
5. **Update API keys if needed**

### Scaling Considerations
- Vercel automatically scales with traffic
- Monitor bundle size as features grow
- Consider CDN for large assets
- Implement caching strategies

### Backup and Recovery
- Code is stored in GitHub
- Environment variables in Vercel
- No database to backup (real-time data)
- Easy redeployment from any commit

---

**For additional support, refer to:**
- [Vercel Documentation](https://vercel.com/docs)
- [Alpaca API Documentation](https://alpaca.markets/docs/)
- [React Error Boundaries](https://reactjs.org/docs/error-boundaries.html)
- [Web Performance Best Practices](https://web.dev/performance/)