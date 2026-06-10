import{c as s,j as e,J as c,y as t,e as n,g as o}from"./index-DTzru_05.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=s("CirclePlus",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M8 12h8",key:"1wcyev"}],["path",{d:"M12 8v8",key:"napkw2"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i=s("Clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=s("House",[["path",{d:"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",key:"5wwlr5"}],["path",{d:"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",key:"1d0kgt"}]]),h=[{label:"Home",icon:p,path:"/"},{label:"Dashboard",icon:t,path:"/seller/dashboard"},{label:"My Products",icon:n,path:"/seller/products"},{label:"Add Product",icon:d,path:"/seller/add-product"},{label:"Orders",icon:o,path:"/seller/orders"},{label:"Pending Approvals",icon:i,path:"/seller/pending-products"}];function x(){return e.jsxs("aside",{className:"w-64 bg-white border-r shadow-sm",children:[e.jsx("div",{className:"h-20 flex items-center px-6 border-b",children:e.jsx("h1",{className:"text-2xl font-bold text-green-800",children:"Seller Panel"})}),e.jsx("nav",{className:"p-4 space-y-2",children:h.map(a=>{const l=a.icon;return e.jsxs(c,{to:a.path,className:({isActive:r})=>`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${r?"bg-green-100 text-green-800":"text-gray-700 hover:bg-gray-100"}`,children:[e.jsx(l,{size:20}),a.label]},a.path)})})]})}function m({children:a}){return e.jsxs("div",{className:"min-h-screen flex bg-green-50",children:[e.jsx(x,{}),e.jsx("main",{className:"flex-1 p-8",children:a})]})}export{m as S};
