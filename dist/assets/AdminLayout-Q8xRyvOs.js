import{c as s,j as a,J as n,y as i,e as l,g as c,K as d}from"./index-BZEZQa2s.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o=s("ClipboardCheck",[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"m9 14 2 2 4-4",key:"df797q"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=s("Settings",[["path",{d:"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",key:"1qme2f"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=s("Users",[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["path",{d:"M22 21v-2a4 4 0 0 0-3-3.87",key:"kshegd"}],["path",{d:"M16 3.13a4 4 0 0 1 0 7.75",key:"1da9ce"}]]),m=[{label:"Dashboard",icon:i,path:"/admin/dashboard"},{label:"Users",icon:p,path:"/admin/users"},{label:"Products",icon:l,path:"/admin/products"},{label:"Orders",icon:c,path:"/admin/orders"},{label:"Product Requests",icon:o,path:"/admin/product-requests"},{label:"Notifications",icon:d,path:"/admin/notifications"},{label:"Settings",icon:h,path:"/admin/settings"}];function x(){return a.jsxs("aside",{className:"w-64 bg-white border-r shadow-sm",children:[a.jsx("div",{className:"h-20 flex items-center px-6 border-b",children:a.jsx("h1",{className:"text-2xl font-bold text-green-800",children:"Admin Panel"})}),a.jsx("nav",{className:"p-4 space-y-2",children:m.map(e=>{const t=e.icon;return a.jsxs(n,{to:e.path,className:({isActive:r})=>`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${r?"bg-green-100 text-green-800":"text-gray-700 hover:bg-gray-100"}`,children:[a.jsx(t,{size:20}),e.label]},e.path)})})]})}function b({children:e}){return a.jsxs("div",{className:"min-h-screen flex bg-[#f5f7fa]",children:[a.jsx(x,{}),a.jsx("main",{className:"flex-1 p-8 overflow-y-auto",children:e})]})}export{b as A,p as U};
