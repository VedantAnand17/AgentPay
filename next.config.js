/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Optimize barrel file imports for better bundle size and cold start performance
    // This transforms imports like `import { X } from 'lucide-react'` to direct imports
    // Provides: 15-70% faster dev boot, 28% faster builds, 40% faster cold starts
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-slot',
    ],
  },
}

module.exports = nextConfig




















