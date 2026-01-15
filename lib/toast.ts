import { toast } from 'sonner';

// 커스텀 토스트 유틸리티
export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
    });
  },

  error: (message: string) => {
    toast.error(message, {
      duration: 4000,
    });
  },

  info: (message: string) => {
    toast.info(message, {
      duration: 3000,
    });
  },

  warning: (message: string) => {
    toast.warning(message, {
      duration: 3500,
    });
  },

  // 거래 관련 토스트
  transactionSaved: () => {
    toast.success('거래가 저장되었습니다');
  },

  transactionDeleted: () => {
    toast.success('거래가 삭제되었습니다');
  },

  categoryDeleted: () => {
    toast.success('카테고리가 삭제되었습니다');
  },

  // 로딩/프로미스 토스트
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(promise, messages);
  },
};

export { toast };
