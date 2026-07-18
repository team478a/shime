export type CheckinSearchFailure = Readonly<{
  message: string;
  requiresLogin: boolean;
}>;

export function getCheckinSearchFailure(status: number): CheckinSearchFailure {
  if (status === 401) {
    return {
      message: "ログインの有効期限が切れました。再ログインしてください。",
      requiresLogin: true,
    };
  }
  if (status === 403) {
    return {
      message: "このアカウントには受付権限がありません。管理者へ確認してください。",
      requiresLogin: false,
    };
  }
  return {
    message: "参加者を検索できませんでした。通信状態を確認して、もう一度お試しください。",
    requiresLogin: false,
  };
}
