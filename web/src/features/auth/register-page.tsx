import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/auth-store';
import { authService } from '@/services/auth.service';
import { getDefaultRouteForRole } from '@/lib/auth-routes';
import { ROUTES } from '@/lib/constants';
import type { UserRole } from '@/types';
import { toast } from 'sonner';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await authService.register(name, email, password, role);
      setAuth(data.user);
      toast.success('Đăng ký thành công!');
      navigate(getDefaultRouteForRole(data.user.role));
    } catch {
      toast.error('Đăng ký thất bại. Email có thể đã tồn tại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-center text-xl">Đăng ký</CardTitle>
      </CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Loại tài khoản</Label>
            <Tabs value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="student">Học sinh</TabsTrigger>
                <TabsTrigger value="teacher">Giáo viên</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Họ tên</Label>
            <Input
              id="name"
              placeholder="Nguyễn Văn A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
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
              placeholder="Tối thiểu 6 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </Button>
        </CardContent>
      </form>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link to={ROUTES.LOGIN} className="text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
