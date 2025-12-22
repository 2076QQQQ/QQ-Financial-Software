// frontend/pages/app/[bookId]/settings/subjects.tsx

import { useRouter } from 'next/router';
import SubjectManagement from './SubjectManagement'; // 确保路径对

export default function SubjectsPage() {
  const router = useRouter();
  
  // ✅ 修改后：直接调用组件，不要传 props
  return <SubjectManagement />;
}