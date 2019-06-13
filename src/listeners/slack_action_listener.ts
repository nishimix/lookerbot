import { SlackUtils } from "../slack_utils"
import { Listener } from "./listener"

export class SlackActionListener extends Listener {

  public bot: any

  public listen() {

    this.server.post("/slack/action", async (req, res) => {

      let payload: any
      try {
        payload = JSON.parse(req.body.payload)
      } catch (e) {
        res.status(400)
        this.reply(res, {error: "Malformed action payload"})
        return
      }

      // Make this look like a botkit message
      const message: any = {}
      for (const key of Object.keys(payload)) {
        message[key] = payload[key]
      }
      message.user = message.user_id
      message.channel = message.channel_id
      message.type = "action"


      console.log(`Received slack action: ${JSON.stringify(message)}`)

      if (!SlackUtils.checkToken(this.bot, message)) {
        res.status(401)
        this.reply(res, {error: "Slack token incorrect."})
        return
      }

      const action = message.actions[0]

      try {
        payload = JSON.parse(action.value)
      } catch (e) {
        res.status(400)
        this.reply(res, {error: "Malformed action value"})
        return
      }

      const looker = this.lookers.filter((l) => l.url === payload.lookerUrl)[0]
      if (!looker) {
        res.status(400)
        this.reply(res, {error: "Unknown looker"})
        return
      }

      // Return OK immediately
      res.send("")
      // TODO check user and use the correct client based on user

      let client = looker.client
      if (message.user === "UJN3N1SGM") {
        client = looker.client2
      }

      try {

        const actionResult = await client.postAsync(
          "data_actions",
          {action: payload.action},
        )

        let text: string
        if (actionResult.success) {
          text = `:white_check_mark: ${actionResult.message || "Done"}!`
        } else if (actionResult.validation_errors) {
          text = actionResult.validation_errors.errors.map((e: any) => `:x: ${e.message}`).join("\n")
        } else {
          text = `:x: ${actionResult.message || "Something went wrong performing the action."}.`
        }

        this.bot.replyPrivateDelayed(message, {
          replace_original: false,
          response_type: "ephemeral",
          text,
        })

      } catch (error) {
        this.bot.replyPrivateDelayed(message, {
          replace_original: false,
          response_type: "ephemeral",
          text: `:warning: Couldn't perform action due to an error: \`${JSON.stringify(error)}\``,
        })
      }

    })
  }
}
