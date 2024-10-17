
export const menuOptions = [
  // '[1] Setup', '[2] Show balance and account address', '[3] Invite', '[4] Fund', '[5] Send', '[6] Withdraw', '[7] Contacts', '[8] Refresh', '[9] Exit'
  '[1] Show balance and account address', '[2] Invite', '[3] Fund', '[4] Send', '[5] Withdraw', '[6] Contacts', '[7] Refresh', '[8] Exit'
];

export function showMenu() {
  for (let i = 0; i < menuOptions.length; i++) {
      console.log(menuOptions[i]);
  }
}

