import{b as a,j as e,v as c,w as t,f as n,h as o}from"./index-BHHENSiz.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i=a("CirclePlus",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M8 12h8",key:"1wcyev"}],["path",{d:"M12 8v8",key:"napkw2"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=a("Clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]),p=[{label:"Dashboard",icon:t,path:"/seller/dashboard"},{label:"My Products",icon:n,path:"/seller/products"},{label:"Add Product",icon:i,path:"/seller/add-product"},{label:"Orders",icon:o,path:"/seller/orders"},{label:"Pending Approvals",icon:d,path:"/seller/pending-products"}];function h(){return e.jsxs("aside",{className:"w-64 bg-white border-r shadow-sm",children:[e.jsx("div",{className:"h-20 flex items-center px-6 border-b",children:e.jsx("h1",{className:"text-2xl font-bold text-green-800",children:"Seller Panel"})}),e.jsx("nav",{className:"p-4 space-y-2",children:p.map(s=>{const r=s.icon;return e.jsxs(c,{to:s.path,className:({isActive:l})=>`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${l?"bg-green-100 text-green-800":"text-gray-700 hover:bg-gray-100"}`,children:[e.jsx(r,{size:20}),s.label]},s.path)})})]})}function m({children:s}){return e.jsxs("div",{className:"min-h-screen flex bg-green-50",children:[e.jsx(h,{}),e.jsx("main",{className:"flex-1 p-8",children:s})]})}export{d as C,m as S};
