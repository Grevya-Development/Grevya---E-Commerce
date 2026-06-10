import{c as b,h as j,r as c,s,e as y,g as P,j as e}from"./index-B_YQtSTW.js";import{U as w,A as N}from"./AdminLayout-ZyC1vUBq.js";import{C as k}from"./clock-BQzuPiui.js";import{D as S}from"./dollar-sign-D7oH2NEU.js";import"./house-B9gdPzsk.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=b("UserCheck",[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["polyline",{points:"16 11 18 13 22 9",key:"1pwet4"}]]);function R(){const l=j(),[t,d]=c.useState({users:0,sellers:0,approvedProducts:0,pendingProducts:0,orders:0,revenue:0}),[i,u]=c.useState(!0),o=async()=>{try{const{count:r}=await s.from("profiles").select("*",{count:"exact",head:!0}),{count:a}=await s.from("profiles").select("*",{count:"exact",head:!0}).eq("role","seller"),{count:m}=await s.from("products").select("*",{count:"exact",head:!0}).eq("product_status","approved"),{count:h}=await s.from("products").select("*",{count:"exact",head:!0}).eq("product_status","pending"),{count:x}=await s.from("orders").select("*",{count:"exact",head:!0}),{data:n}=await s.from("orders").select("total_amount"),g=(n==null?void 0:n.reduce((v,f)=>v+(f.total_amount||0),0))||0;d({users:r||0,sellers:a||0,approvedProducts:m||0,pendingProducts:h||0,orders:x||0,revenue:g})}catch(r){console.error(r)}u(!1)};c.useEffect(()=>{o();const r=s.channel("dashboard-realtime").on("postgres_changes",{event:"*",schema:"public",table:"profiles"},()=>o()).on("postgres_changes",{event:"*",schema:"public",table:"products"},()=>o()).on("postgres_changes",{event:"*",schema:"public",table:"orders"},()=>o()).subscribe();return()=>{s.removeChannel(r)}},[]);const p=[{title:"Total Users",value:t.users,icon:w,route:"/admin/users"},{title:"Total Sellers",value:t.sellers,icon:C,route:"/admin/users"},{title:"Approved Products",value:t.approvedProducts,icon:y,route:"/admin/products"},{title:"Pending Requests",value:t.pendingProducts,icon:k,route:"/admin/product-requests"},{title:"Orders",value:t.orders,icon:P,route:"/admin/orders"},{title:"Revenue",value:`₹${t.revenue}`,icon:S,route:"/admin/orders"}];return e.jsxs(N,{children:[e.jsxs("div",{className:"mb-8",children:[e.jsx("h1",{className:"text-3xl font-bold text-green-900",children:"Admin Dashboard"}),e.jsx("p",{className:"text-gray-600 mt-2",children:"Real-Time Platform Analytics"})]}),i?e.jsx("p",{children:"Loading..."}):e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6",children:p.map(r=>{const a=r.icon;return e.jsx("div",{onClick:()=>l(r.route),className:`\r
                bg-white\r
                rounded-2xl\r
                shadow-sm\r
                border\r
                p-6\r
                cursor-pointer\r
                transition-all\r
                duration-300\r
                hover:shadow-xl\r
                hover:-translate-y-2\r
                hover:border-green-500\r
                hover:bg-green-50/30`,children:e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-gray-500 text-sm",children:r.title}),e.jsx("h2",{className:"text-3xl font-bold mt-2 text-gray-900",children:r.value})]}),e.jsx("div",{className:"bg-green-100 text-green-700 p-4 rounded-xl",children:e.jsx(a,{size:28})})]})},r.title)})})]})}export{R as default};
