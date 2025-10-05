# Deployment Checklist

## Before Deploying:
- [ ] Run `npm run build` successfully
- [ ] Test production build locally: `npm run preview`
- [ ] Verify all components work in production build
- [ ] Check that your Claude artifacts work correctly
- [ ] Ensure all assets load properly

## Domain Configuration:
- [ ] Update any absolute URLs to relative URLs
- [ ] Configure proper base path if needed
- [ ] Set up SSL certificate (HTTPS)
- [ ] Test on mobile devices

## Post-Deployment:
- [ ] Test the live site thoroughly
- [ ] Check browser console for errors
- [ ] Verify all routes work (if you add routing later)
- [ ] Test Claude artifact copy-paste functionality

## Performance:
- [ ] Enable gzip compression on your server
- [ ] Set up proper caching headers
- [ ] Consider CDN for faster loading
