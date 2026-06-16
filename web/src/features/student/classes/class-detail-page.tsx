import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useClassDetail } from '@/hooks/use-class-detail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { StudentInfoTab } from './tabs/info-tab';
import { StudentTopicsTab } from './tabs/topics-tab';
import { StudentDocumentsTab } from './tabs/documents-tab';
import { StudentQuizzesTab } from './tabs/quizzes-tab';
import { StudentSelfPracticeTab } from './tabs/self-practice-tab';

const VALID_TABS = ['info', 'topics', 'documents', 'quizzes', 'practice'] as const;
type TabValue = (typeof VALID_TABS)[number];

export function StudentClassDetailPage() {
  const { classId = '' } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabValue = VALID_TABS.includes(tabParam as TabValue) ? (tabParam as TabValue) : 'info';

  const { data: cls, isLoading } = useClassDetail(classId);

  const setTab = (tab: TabValue) => {
    setSearchParams(tab === 'info' ? {} : { tab });
  };

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  }

  if (!cls) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Không tìm thấy lớp học</p>
        <Button variant="link" onClick={() => navigate('/student/classes')}>Quay lại</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/student/classes')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Danh sách lớp
      </Button>

      <div>
        <h1 className="text-2xl font-bold">{cls.name}</h1>
        {cls.description && (
          <p className="mt-1 text-sm text-muted-foreground">{cls.description}</p>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="topics">Chủ đề</TabsTrigger>
          <TabsTrigger value="documents">Tài liệu</TabsTrigger>
          <TabsTrigger value="quizzes">Quiz lớp</TabsTrigger>
          <TabsTrigger value="practice">Tự luyện tập</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <StudentInfoTab classId={classId} classDetail={cls} />
        </TabsContent>
        <TabsContent value="topics" className="mt-6">
          <StudentTopicsTab topics={cls.topics} />
        </TabsContent>
        <TabsContent value="documents" className="mt-6">
          <StudentDocumentsTab classId={classId} />
        </TabsContent>
        <TabsContent value="quizzes" className="mt-6">
          <StudentQuizzesTab classId={classId} />
        </TabsContent>
        <TabsContent value="practice" className="mt-6">
          <StudentSelfPracticeTab classId={classId} topics={cls.topics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
