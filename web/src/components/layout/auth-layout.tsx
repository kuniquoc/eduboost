import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            E
          </div>
          <h1 className="text-2xl font-bold text-foreground">EduBoost</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI Gia sư cá nhân</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
