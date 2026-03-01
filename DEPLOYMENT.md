# Deploy Flower Shop Manager to Vercel

## Step 1: Push to GitHub

1. Tạo repository mới trên GitHub: https://github.com/new
   - Repository name: `flower-shop-manager`
   - Public
   - Không add README, .gitignore

2. Push code lên GitHub:
```bash
git remote add origin https://github.com/YOUR_USERNAME/flower-shop-manager.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Vercel

1. Truy cập: https://vercel.com
2. Đăng nhập bằng GitHub
3. Click "New Project"
4. Chọn repository `flower-shop-manager`
5. Cấu hình:
   - Framework: `Create React App`
   - Build Command: `npm run build`
   - Output Directory: `build`
   - Install Command: `npm install`

## Step 3: Environment Variables

Trong Vercel dashboard, thêm environment variables:

1. Vào Settings → Environment Variables
2. Thêm:
   - `REACT_APP_NEON_DATABASE_URL`: `postgresql://neondb_owner:npg_d2Yy7AlxTfHU@ep-divine-silence-a1nd0j8x-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
   - `REACT_APP_JWT_SECRET`: `7f3a9c2e5d4b8a1f6c9e3d2b7a8f4e6c1d9b3a5f7e2c4d6b8a1e3f5c7d9a2b4`

## Step 4: Redeploy

Sau khi thêm environment variables:
1. Vào Deployments
2. Click "Redeploy" hoặc push commit mới

## Alternative: Netlify

Nếu Vercel có vấn đề, dùng Netlify:
1. Truy cập: https://netlify.com
2. Kéo thả folder `build` vào
3. Add environment variables trong Site settings

## URL sau khi deploy

App sẽ có dạng:
- Vercel: `https://flower-shop-manager.vercel.app`
- Netlify: `https://flower-shop-manager.netlify.app`
