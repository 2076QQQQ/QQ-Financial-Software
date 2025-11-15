import { useState } from 'react';
import LoginEntry from './components/LoginEntry';
import CreateCompany from './components/CreateCompany';
import LoginPassword from './components/LoginPassword';
import ResetPassword from './components/ResetPassword';
import ResetPasswordSent from './components/ResetPasswordSent';
import SetNewPassword from './components/SetNewPassword';
import ActivateAccount from './components/ActivateAccount';
import MainLayout from './components/MainLayout';

type Page = 
  | 'login-entry'
  | 'create-company'
  | 'login-password'
  | 'reset-password'
  | 'reset-password-sent'
  | 'set-new-password'
  | 'activate-account'
  | 'main-layout';

interface UserData {
  email: string;
  name?: string;
  companyName?: string;
  role?: 'Boss' | '会计' | '出纳';
  isAdmin?: boolean;
  isOwner?: boolean;
  hasAccountBook?: boolean;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('login-entry');
  const [userData, setUserData] = useState<UserData>({ email: '' });
  const [resetEmail, setResetEmail] = useState('');
  const [inviteToken, setInviteToken] = useState('');

  // 模拟用户数据库（在实际应用中应该使用后端）
  const [users] = useState([
    { 
      email: 'existing@company.com', 
      password: '123456', 
      name: '张三', 
      companyName: 'XX商贸', 
      role: 'Boss', 
      isAdmin: true, 
      isOwner: true,
      hasAccountBook: true  // 老用户已有账套
    },
    { 
      email: 'newuser@company.com', 
      password: '123456', 
      name: '李四', 
      companyName: '新公司', 
      role: 'Boss', 
      isAdmin: true, 
      isOwner: true,
      hasAccountBook: false  // 新用户无账套
    }
  ]);

  const handleEmailSubmit = (email: string) => {
    // 检查用户是否存在
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      setUserData({ 
        email: existingUser.email,
        name: existingUser.name,
        companyName: existingUser.companyName,
        role: existingUser.role as 'Boss' | '会计' | '出纳',
        isAdmin: existingUser.isAdmin,
        isOwner: existingUser.isOwner,
        hasAccountBook: existingUser.hasAccountBook
      });
      setCurrentPage('login-password');
    } else {
      setUserData({ email });
      setCurrentPage('create-company');
    }
  };

  const handleCreateCompany = (data: UserData) => {
    setUserData({ ...data, isOwner: true, hasAccountBook: false });
    setCurrentPage('main-layout');
  };

  const handleLogin = () => {
    // userData 已经在 handleEmailSubmit 中设置好了（包含 hasAccountBook）
    setCurrentPage('main-layout');
  };

  const handleResetPassword = (email: string) => {
    setResetEmail(email);
    setCurrentPage('reset-password-sent');
  };

  const handleSetNewPassword = () => {
    setCurrentPage('login-entry');
  };

  const handleActivateAccount = (data: UserData) => {
    setUserData(data);
    setCurrentPage('main-layout');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {currentPage === 'login-entry' && (
        <LoginEntry onContinue={handleEmailSubmit} />
      )}
      {currentPage === 'create-company' && (
        <CreateCompany 
          email={userData.email} 
          onBack={() => setCurrentPage('login-entry')}
          onCreate={handleCreateCompany}
        />
      )}
      {currentPage === 'login-password' && (
        <LoginPassword 
          email={userData.email}
          onBack={() => setCurrentPage('login-entry')}
          onLogin={handleLogin}
          onForgotPassword={() => setCurrentPage('reset-password')}
        />
      )}
      {currentPage === 'reset-password' && (
        <ResetPassword 
          onSendReset={handleResetPassword}
          onBack={() => setCurrentPage('login-password')}
        />
      )}
      {currentPage === 'reset-password-sent' && (
        <ResetPasswordSent 
          email={resetEmail}
          onOpenEmail={() => setCurrentPage('set-new-password')}
        />
      )}
      {currentPage === 'set-new-password' && (
        <SetNewPassword 
          onSuccess={handleSetNewPassword}
        />
      )}
      {currentPage === 'activate-account' && (
        <ActivateAccount 
          token={inviteToken}
          onActivate={handleActivateAccount}
        />
      )}
      {currentPage === 'main-layout' && (
        <MainLayout 
          user={userData}
          onLogout={() => setCurrentPage('login-entry')}
          initialHasAccountBook={userData.hasAccountBook || false}
        />
      )}
    </div>
  );
}