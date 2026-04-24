This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.



src/
│
├── app/                  # Next.js App Router
│   ├── (auth)/           # Auth routes group
│   │   ├── login/
│   │   └── register/
│   │
│   ├── (dashboard)/      # Protected routes
│   │   ├── admin/
│   │   ├── user/
│   │
│   ├── layout.js         # GLOBAL layout (single place ✅)
│   ├── page.js           # Home page
│   └── globals.css
│
├── components/           # Reusable UI components 🔁
│   ├── ui/               # Small UI components
│   │   ├── Button.js
│   │   ├── Input.js
│   │   ├── Card.js
│   │   └── Modal.js
│   │
│   ├── layout/           # Layout components
│   │   ├── Navbar.js
│   │   ├── Sidebar.js
│   │   └── Footer.js
│   │
│   └── shared/           # Shared reusable logic components
│       ├── Loader.js
│       └── EmptyState.js
│
├── lib/                  # Utilities & helpers
│   ├── fetcher.js        # Central fetch logic ✅
│   ├── auth.js           # Auth helpers
│   └── constants.js
│
├── hooks/                # Custom hooks
│   ├── useAuth.js
│   └── useFetch.js
│
├── services/             # API calls (clean separation)
│   ├── auth.service.js
│   ├── user.service.js
│   └── admin.service.js
│
├── store/                # (Optional) state management
│   └── useStore.js
│
├── middleware.js         # Role-based protection 🔐
└── config/
    └── roles.js          # Role definitions




npm install @reduxjs/toolkit react-redux
npm install redux-persist redux-persist-transform-encrypt



```bash
# Both are same
bg-[#f0f4f8]
bg-slate-100 
```