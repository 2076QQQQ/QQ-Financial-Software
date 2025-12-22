// src/lib/hooks/usePermission.ts

import { useState, useEffect } from 'react';
import { me } from '@/lib/mockData';

export function usePermission() {
  const [role, setRole] = useState<string>(''); 
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    async function fetchRole() {
      try {
        const res = await me();
        if (mounted && res?.user) {
          // 调试日志：看看后端到底返回了什么
          console.log(`[权限调试] 当前用户: ${res.user.name}, 角色: "${res.user.role}", 是否管理员: ${res.user.isAdmin}`);
          
          setRole(res.user.role || ''); 
          setIsAdmin(!!res.user.isAdmin);
        }
      } catch (e) {
        console.error("获取权限失败", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchRole();
    return () => { mounted = false; };
  }, []);

  // ✅ 核心修复：改为【白名单】机制
  // 只有列表里的角色才有资格审核。出纳不在列表里，自然就无法审核。
  const AUDIT_WHITELIST = ['Owner', 'Boss', '会计', '管理员'];

  return {
    loading,
    role,
    isAdmin,
    
    // === 业务权限 ===
    
    // 1. 审核权：只有白名单里的人能做，且不能是出纳 (双重保险)
    canAudit: !loading && AUDIT_WHITELIST.includes(role) && role !== '出纳',
    
    // 2. 凭证录入权：通常出纳只负责日记账，会计负责凭证
    // 这里假设出纳也不能录凭证（你可以根据实际需求改）
    canEditVoucher: !loading && role !== '出纳', 
    
    // 3. 团队管理权：Owner 或 Admin 才有权
    canManageTeam: !loading && (role === 'Owner' || isAdmin),
    
    // 4. 转让权：只有 Owner
    canTransferOwner: !loading && role === 'Owner',
  };
}