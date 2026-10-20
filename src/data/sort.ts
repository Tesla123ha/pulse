/** Newest first, comparing real instants: server and local timestamps are formatted differently. */
export const byTimeDesc = (a: { logged_at: string }, b: { logged_at: string }) =>
  new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime();
