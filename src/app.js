import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import dayjs from "dayjs"
import joi from "joi"

const app = express()
app.use(express.json())
app.use(cors())
dotenv.config()


const mongoClient = new MongoClient(process.env.DATABASE_URL)

try {
    await mongoClient.connect()
    console.log("MongoDB connected!")
} catch (err) {
    console.log(err.message)
}
const db = mongoClient.db()


app.post("/participants", async (req, res) => {
    const {name} = req.body

    const participantSchema = joi.object({name: joi.string().required()})
    const validation = participantSchema.validate(req.body, { abortEarly: false })

    if(validation.error) {
        const errors = validation.error.details.map(detail => detail.message)
        return res.status(422).send(errors)
    } 

    try {
        const participantFind = await db.collection("participants").findOne({name: name})

        if(participantFind) {
            return res.status(409).send(participantFind)
        }

        const newParticipant = {name: name, lastStatus: Date.now()}
        await db.collection("participants").insertOne(newParticipant)

        const now = dayjs().format("HH:mm:ss")
        const loginMessage = {from: name, to:"Todos", text:"entra na sala...", type:"status", time: now}
        await db.collection("messages").insertOne(loginMessage)
        res.sendStatus(201)

    } catch (err) {
        console.log(err.message)
    }

})

app.get("/participants", async (req, res) => {
    try {
        const findParticipants = await db.collection("participants").find().toArray()
        res.send(findParticipants)
    } catch (err) {
        console.log(err.message)
    }
    
})

app.post("/messages", (req, res) => {
    const {to, text, type} = req.body
    const userName = req.headers.user
    const time = dayjs().format("HH:mm:ss")

    db.collection("participants").findOne({name: userName})
    .then((resp)=> {
        console.log(resp)
        if(!resp) {
            return res.status(422).send(resp)
        }

        db.collection("messages").insertOne({
            from: userName,
            to,
            text,
            type,
            time
        })
        .then(()=>res.sendStatus(201))
        .catch(err => console.log(err.message))
    })
    .catch(err => console.log(err.message))

})

app.get("/messages", (req, res) => {
    const userName = req.headers.user
    const { limit } = req.query

    db.collection("messages").find({$or: [{from: userName}, {to: "Todos"}, {to: userName}]}).toArray()
    .then((resp)=> {

        if(limit<1 || (isNaN(limit))&&limit!=undefined) {
            res.sendStatus(422)
        }

        if(limit) {
            res.send(resp.slice(-limit))
        }

        res.send(resp)
    })
    .catch(err=>console.log(err.message))
})

app.post("/status", (req, res) => {
    const userName = req.headers.user

    if(!userName) res.sendStatus(404)

    db.collection("participants").findOne({name: userName})
    .then((resp)=>{
        
        if(!resp) res.sendStatus(404)


    })
    .catch(err=>console.log(err.message))
})

const PORT = 5000
app.listen(PORT, ()=>console.log(`Server ON na porta:${PORT}`))