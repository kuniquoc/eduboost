import { Link } from 'react-router-dom';
import { buttonVariants } from '@/shared/ui/button-variants';
import { Bot, BarChart3, Target, FileText } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

const features = [
  {
    icon: Bot,
    title: 'AI Agent thông minh',
    description: 'Tự ra quyết định dạy, kiểm tra và điều chỉnh lộ trình học cho từng học sinh.',
  },
  {
    icon: BarChart3,
    title: 'Theo dõi kiến thức',
    description: 'BKT & IRT đánh giá chính xác mức độ hiểu biết từng kỹ năng.',
  },
  {
    icon: Target,
    title: 'Cá nhân hóa',
    description: 'Lộ trình học riêng biệt, thích ứng theo năng lực từng người.',
  },
  {
    icon: FileText,
    title: 'Sinh quiz tự động',
    description: 'AI tạo bài tập đa dạng từ tài liệu giáo viên upload.',
  },
];

const steps = [
  { step: '1', title: 'Tham gia lớp', description: 'Nhập mã lớp từ giáo viên' },
  { step: '2', title: 'Làm bài test', description: 'Đánh giá kiến thức ban đầu' },
  { step: '3', title: 'AI tạo lộ trình', description: 'Kế hoạch học riêng cho bạn' },
  { step: '4', title: 'Luyện tập', description: 'Thích ứng theo tiến độ' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              E
            </div>
            <span className="text-lg font-semibold text-foreground">EduBoost</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className={cn(buttonVariants({ variant: 'ghost' }))}>
              Đăng nhập
            </Link>
            <Link to="/register" className={cn(buttonVariants())}>
              Đăng ký
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          AI Gia sư cá nhân
          <br />
          <span className="text-primary">cho mọi học sinh</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Hệ thống học tập thông minh sử dụng AI Agent để mô phỏng gia sư cá nhân,
          theo dõi kiến thức và thích ứng lộ trình học cho từng người.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link to="/register" className={cn(buttonVariants({ size: 'lg' }))}>
            Bắt đầu miễn phí
          </Link>
          <Link to="/login" className={cn(buttonVariants({ size: 'lg', variant: 'outline' }))}>
            Đăng nhập
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="mb-12 text-center text-3xl font-bold text-foreground">
            Tính năng nổi bật
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold text-foreground">
          Cách hoạt động
        </h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.step} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {s.step}
              </div>
              <h3 className="mb-1 text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>&copy; 2026 EduBoost. AI-Powered Adaptive Learning Platform.</p>
      </footer>
    </div>
  );
}
