// database.ts

import fs from 'fs';
import path from 'path';

// 定义数据库结构类型 (Database Schema Definition)
export interface DatabaseSchema {
  users: any[];
  companies: any[];
  invitations: any[];
  passwordResets: any[];
  accountBooks: any[];        // 账套信息 (UC01)
  subjects: any[];            // 会计科目 (UC02)
  fundAccounts: any[];        // 资金账户 (UC09)
  auxiliaryCategories: any[]; // 辅助核算维度 (UC03)
  auxiliaryItems: any[];      // 辅助核算项目 (UC03)
  auxiliaryTypes: any[];      // 辅助核算类别 (UC03, 预留)
  initialBalances: any[];     // 期初余额记录 (UC04)
  companyInfo: any;
  vouchers: any[];            // 凭证表 (UC06)
  voucherTemplates: any[];    // 凭证模板表 (UC05)
  closingTemplates: any[];
  // ★★★ 新增业务模块存储 ★★★
  journalEntries: any[];      // 出纳日记账流水 (UC11)
  expenseCategories: any[];   // 收支类别映射 (UC10)
  internalTransfers: any[];   // 内部转账记录 (UC12)
}

// 数据库文件路径
const DB_PATH = path.join(__dirname, 'db.json');

// 默认空数据结构
const defaultData: DatabaseSchema = {
  users: [],
  companies: [],
  invitations: [],
  passwordResets: [],
  accountBooks: [],
  subjects: [],
  fundAccounts: [],
  auxiliaryCategories: [], // 辅助核算维度 (UC03)
  auxiliaryItems: [],
  auxiliaryTypes: [],
  initialBalances: [],
  companyInfo: {},
  vouchers: [],
  voucherTemplates: [],
  closingTemplates: [],
  
  journalEntries: [],
  expenseCategories: [],
  internalTransfers: []
};

/**
 * 模拟文件数据库的单例类
 */
export class DB {
  private data: DatabaseSchema;

  constructor() {
    this.data = defaultData;
  }

  // 初始化数据库
  public async init() {
    if (!fs.existsSync(DB_PATH)) {
      this.data = defaultData;
      this.save();
      console.log('🆕 Database file created at:', DB_PATH);
    } else {
      try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const loadedData = JSON.parse(raw);
        // 容错处理：确保读取的数据包含最新的默认字段
        this.data = { ...defaultData, ...loadedData };
      } catch (e) {
        console.error('❌ Database load error, resetting to default:', e);
        this.data = defaultData;
        this.save();
      }
    }
  }

  // 保存数据到磁盘
  private save() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('❌ Failed to save database:', e);
    }
  }

  // 获取全量数据
  public get(): DatabaseSchema {
    return this.data;
  }

  /**
   * 通用更新方法
   */
  public update(key: keyof DatabaseSchema, value: any[]) {
    (this.data as any)[key] = value;
    this.save();
  }

  /**
   * ★★★ 核心业务方法：删除凭证并解锁关联流水 ★★★
   * 这个方法必须放在这里，因为它涉及多个表的原子性修改
   */
  public deleteVoucher(id: string): boolean {
    console.log(`[DB] 尝试删除凭证，ID: ${id}`);

    // 1. 查找凭证
    const voucherIndex = this.data.vouchers.findIndex(v => v.id === id);
    if (voucherIndex === -1) {
      console.log(`[DB] ❌ 没找到凭证，ID: ${id}`);
      return false;
    }

    const voucher = this.data.vouchers[voucherIndex];
    const targetCode = voucher.voucherCode; // 例如 "记-001"
    
    console.log(`[DB] 准备删除凭证: ${targetCode}，并清理关联的日记账...`);

    // 2. 删除凭证
    this.data.vouchers.splice(voucherIndex, 1);

    // 3. 解锁日记账 (Journal Entries)
    let unlockedJournalCount = 0;
    if (targetCode && this.data.journalEntries) {
      this.data.journalEntries = this.data.journalEntries.map(entry => {
        if (entry.voucherCode === targetCode) {
          unlockedJournalCount++;
          // 关键：置空 voucherCode，即解锁
          return { ...entry, voucherCode: null }; 
        }
        return entry;
      });
    }

    // 4. 解锁内部转账单 (Internal Transfers)
    let unlockedTransferCount = 0;
    if (targetCode && this.data.internalTransfers) {
        this.data.internalTransfers = this.data.internalTransfers.map(tr => {
            if (tr.voucherCode === targetCode) {
                unlockedTransferCount++;
                return { ...tr, voucherCode: null };
            }
            return tr;
        });
    }

    console.log(`[DB] ✅ 成功删除凭证。解锁流水: ${unlockedJournalCount} 条, 解锁转账单: ${unlockedTransferCount} 条`);

    // 5. 保存文件
    this.save();
    return true;
  }
}

// 导出单例
export const db = new DB();

// 初始化函数
export const initDb = async () => {
  await db.init();
};