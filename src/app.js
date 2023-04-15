import express from "express"
import cors from "cors"
import { MongoClient, ObjectId } from "mongodb"
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
        res.send(err.message)
    }

})

app.get("/participants", async (req, res) => {
    try {
        const findParticipants = await db.collection("participants").find().toArray()
        res.send(findParticipants)
    } catch (err) {
        res.send(err.message)
    }
    
})

app.post("/messages", async (req, res) => {
    const {to, text, type} = req.body
    const userName = req.headers.user
    
    const bodySchema = joi.object({
        to: joi.string().min(1).required(),
        text: joi.string().min(1).required(),
        type: joi.valid("message", "private_message").required()
    })

    const validation = bodySchema.validate(req.body, { abortEarly: false })    

    try {
        const participantFind = await db.collection("participants").findOne({name: userName})

        if(!participantFind) return res.sendStatus(422)

        if(validation.error) {
            /* const errors = validation.error.details.map((errors) => errors.message) */
            return res.sendStatus(422)
        }

        const time = dayjs().format("HH:mm:ss")
        await db.collection("messages").insertOne({
            from: userName,
            to,
            text,
            type,
            time
        })
        res.sendStatus(201)
    } catch (err) {
        res.send(err.message)
    }
})

app.get("/messages", async (req, res) => {
    const userName = req.headers.user
    const { limit } = req.query

    try {
        const messagesFind = await db.collection("messages").find({$or: [{from: userName}, {to: "Todos"}, {to: userName}]}).toArray()
        if(limit<1 || (isNaN(limit))&&limit!=undefined) {
            return res.sendStatus(422)
        }

        if(limit) {
            return res.send(messagesFind.slice(-limit))
        }

        res.send(messagesFind)
    } catch (err) {
        res.send(err.message)
    }
})

app.post("/status", async (req, res) => {
    const userName = req.headers.user

    if(!userName) res.sendStatus(404)
    try {
        const participantFind = await db.collection("participants").findOne({name: userName})

        if (!participantFind) res.sendStatus(404)

        await db.collection("participants").updateOne(
            {name: userName},
            {$set: {name: userName, lastStatus: Date.now()}}
        )
        res.sendStatus(200)

    } catch (err) {
        res.send(err.message)
    }
})

app.delete("/messages/:id", async (req, res) => {
    const userName = req.headers.user
    const id = req.params

    try {
        const messageFind = await db.collection("messages").findOne({_id: new ObjectId(id)})

        if(!messageFind) return res.sendStatus(404)

        if(messageFind.from !== userName) return res.sendStatus(401)

        await db.collection("messages").deleteOne({_id: new ObjectId(id)})
    } catch (err) {
        res.send(err.message)
    }
})

app.put("/messages/:id", async (req, res) => {
    const {to, text, type} = req.body
    const userName = req.headers.user
    const id = req.params

    const bodySchema = joi.object({
        to: joi.string().min(1),
        text: joi.string().min(1),
        type: joi.valid("message", "private_message")
    })

    const validation = bodySchema.validate(req.body, {abortEarly: false })

    try {
        const userFind = await db.collection("participants").findOne({name: userName})
        if(!userFind) return res.sendStatus(422)
        if(validation.error) return res.sendStatus(422)

        const messageFind = await db.collection("messages").findOne({_id: new ObjectId(id)})
        if(!messageFind) return res.sendStatus(404)
        if(messageFind.from !== userName) return res.sendStatus(401)

        await db.collection("messages").updateOne({_id: new ObjectId(id)}, {$set: req.body})
    } catch (err) {
        res.send(err.message)
    }
})

setInterval(async ()=>{
    const time = Date.now() - 10000
    const deletedParticipants = await db.collection("participants").find({lastStatus: {$lt: time}}).toArray()
    await db.collection("participants").deleteMany({lastStatus: {$lt: time}})

    deletedParticipants.map( async (participant)=>{
        const time = dayjs().format("HH:mm:ss")
        await db.collection("messages").insertOne({
            from: participant.name,
            to: "Todos",
            text: "sai da sala...",
            type: "status",
            time: time
        })
    })

}, 15000)

const PORT = 5000
app.listen(PORT, ()=>console.log(`Server ON na porta:${PORT}`))