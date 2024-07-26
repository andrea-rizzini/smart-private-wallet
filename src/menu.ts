
export const menuOptions = [
 '[1] Show balance', '[2] Invite', '[3] Send', '[4] Receive', '[5] Refresh', '[6] Contacts', '[7] Exit'
];

export function showMenu() {
  for (let i = 0; i < menuOptions.length; i++) {
      console.log(menuOptions[i]);
  }
}

