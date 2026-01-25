# Environment setup (AgriConnect)

## 1) Frontend

Create `.env` from the template:

```bash
cp .env.example .env
```

Edit `.env`:
- `VITE_API_URL` should be your backend API URL ending with `/api`

## 2) Backend

Create `server/.env` from the template:

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:
- Set `DATABASE_URL`
- Set `JWT_SECRET`
- (Optional) Configure Twilio, Airtel, OpenAI, Redis, Blockchain

## 3) Prisma / Database

You can set `DATABASE_URL` either in `server/.env` or `prisma/.env`.

If you prefer a Prisma-specific env file:

```bash
cp prisma/.env.example prisma/.env
```

## 4) Run migrations and start

```bash
npx prisma migrate dev
npx prisma generate
npm run server
```

In a separate terminal:

```bash
npm run dev
```

