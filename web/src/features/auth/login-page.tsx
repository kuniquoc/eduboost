import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth-store';
import { authService } from '@/services/auth.service';
import { getDefaultRouteForRole } from '@/lib/auth-routes';
import { ROUTES } from '@/lib/constants';
import { toast } from 'sonner';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      setAuth(data.user);
      navigate(getDefaultRouteForRole(data.user.role));
    } catch {
      toast.error('Email hoặc mật khẩu không đúng');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-center text-xl">Đăng nhập</CardTitle>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
          <div className="space-y-2 pt-2">
            <p className="text-center text-xs text-muted-foreground">Tài khoản demo (mật khẩu: password123)</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={loading}
                onClick={() => { setEmail('teacher@eduboost.vn'); setPassword('password123'); }}
              >
                GV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={loading}
                onClick={() => { setEmail('student@eduboost.vn'); setPassword('password123'); }}
              >
                HS
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={loading}
                onClick={() => { setEmail('admin@eduboost.vn'); setPassword('password123'); }}
              >
                Admin
              </Button>
            </div>
          </div>
        </CardContent>
      </form>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Chưa có tài khoản?{' '}
          <Link to={ROUTES.REGISTER} className="text-primary hover:underline">
            Đăng ký
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
