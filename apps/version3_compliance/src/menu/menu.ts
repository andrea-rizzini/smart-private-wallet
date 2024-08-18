
export const menuOptions = [
  '[1] Setup', '[2] Show balance and account address', '[3] Invite', '[4] Fund', '[5] Send', '[6] Withdraw', '[7] Contacts', '[8] Refresh', '[9] Exit'
];

export function showMenu() {
  for (let i = 0; i < menuOptions.length; i++) {
      console.log(menuOptions[i]);
  }
}

