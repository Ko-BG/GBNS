const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

let users = [];

app.get("/",(req,res)=>{
  res.send("Backend running ✅");
});

app.post("/signup",(req,res)=>{
  users.push(req.body);
  res.json({success:true});
});

app.post("/login",(req,res)=>{
  const u = users.find(x=>x.id===req.body.id && x.pass===req.body.pass);
  if(!u) return res.json({success:false});
  res.json({success:true,user:u});
});

const PORT = process.env.PORT || 10000;
app.listen(PORT,()=>console.log("Running on",PORT));
