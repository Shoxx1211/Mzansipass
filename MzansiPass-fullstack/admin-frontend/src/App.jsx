import React, {useState} from 'react'
import axios from 'axios'

export default function App(){
  const [key,setKey]=useState('')
  const [users,setUsers]=useState([])
  const [cards,setCards]=useState([])
  const [trips,setTrips]=useState([])
  const load = async ()=>{
    try{
      const hu = await axios.get('/admin/users',{headers:{'X-ADMIN-KEY':key}})
      setUsers(hu.data)
      const hc = await axios.get('/admin/cards',{headers:{'X-ADMIN-KEY':key}})
      setCards(hc.data)
      const ht = await axios.get('/admin/trips',{headers:{'X-ADMIN-KEY':key}})
      setTrips(ht.data)
    }catch(e){
      alert('error: '+(e.response?.data?.msg||e.message))
    }
  }
  return (<div style={{padding:20,fontFamily:'Arial'}}>
    <h2>Mzansi Admin Panel (Minimal)</h2>
    <p>Enter ADMIN KEY (SECRET_KEY) to access API</p>
    <input value={key} onChange={e=>setKey(e.target.value)} style={{width:400}} />
    <button onClick={load} style={{marginLeft:10}}>Load</button>
    <h3>Users</h3>
    <pre>{JSON.stringify(users,null,2)}</pre>
    <h3>Cards</h3>
    <pre>{JSON.stringify(cards,null,2)}</pre>
    <h3>Trips</h3>
    <pre>{JSON.stringify(trips,null,2)}</pre>
  </div>)
}
