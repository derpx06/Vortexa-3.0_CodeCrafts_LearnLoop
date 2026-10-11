import { AuthForm } from '@/components/auth/auth-form';

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthForm
      mode="login"
      next={typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : '/'}
    />
  );
}
