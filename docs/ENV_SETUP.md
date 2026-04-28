# Environment setup (AgriConnect)

## 1) Frontend

Create `.env` from the template:

```bash
cp .env.example .env
```

Edit `.env`:
- `VITE_API_URL` should be your backend API URL ending with `/api`

## 2) Backend

The backend also reads the root `.env` file.

Edit `.env`:
- Set `DATABASE_URL`
- Set `JWT_SECRET`
- (Optional) Configure Twilio, Airtel, OpenAI, Redis, Blockchain

## 3) Prisma / Database

Prisma reads `DATABASE_URL` from the root `.env` file.

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

