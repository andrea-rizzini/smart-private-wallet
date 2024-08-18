
export const menuOptions = [
 '[1] Show balance and account address', '[2] Invite', '[3] Send', '[4] Fund', '[5] Contacts', '[6] Refresh', '[7] Exit'
];

export function showMenu() {
  for (let i = 0; i < menuOptions.length; i++) {
      console.log(menuOptions[i]);
  }
}

