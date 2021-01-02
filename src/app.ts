import chromedriver from 'chromedriver'
import { ICard, ICardField, IData } from './models'
import { WebDriver, Builder, By, Key } from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome'
import fetch from 'node-fetch'

chrome.setDefaultService(new chrome.ServiceBuilder(chromedriver.path).build())

export default class Bot {
  // class properties
  email: string
  password: string
  link: string
  maxPrice?: number
  card?: ICard
  refreshRate?: number
  phone?: string

  // map initialized values to class properties
  constructor({ email, password, link, maxPrice, card, refreshRate, phone }: IData) {
    ;(this.email = email),
      (this.password = password),
      (this.link = link),
      (this.maxPrice = maxPrice),
      (this.card = card),
      (this.refreshRate = refreshRate),
      (this.phone = phone)
  }

  // main method
  async run() {
    try {
      // this creates a new chrome window
      const driver = await new Builder().forBrowser('chrome').build()
      this.sleep(1000)
      await this.login(driver)
      await this.runItem(driver)
      await this.buyItem(driver)
    } catch (err) {
      console.error('ERROR NOT CAUGHT WHILE RUNNING BOT. MORE INFO BELOW')
      console.error(err)
    }
  }

  async login(driver: WebDriver) {
    await driver
      .navigate()
      .to('https://www.pccomponentes.com/login')
      .then(async () => {
        // fills the form and logs in
        await driver
          .findElement(By.css("input[data-cy='email']"))
          .then(value => value.sendKeys(this.email.trim()))
        await driver
          .findElement(By.css("input[data-cy='password']"))
          .then(value => value.sendKeys(this.password.trim(), Key.RETURN))
        await this.sleep(3000)
        // checks if logged in
        if (!((await driver.getCurrentUrl()) == 'https://www.pccomponentes.com/'))
          throw Error(`ERROR: Login to account with email ${this.email} failed`)
        console.log(`Successfully logged in as ${this.email}`)
      })
  }

  async runItem(driver: WebDriver) {
    // navigates to the item link provided
    await driver
      .navigate()
      .to(this.link)
      .then(async () => {
        let stock: boolean = false
        let price: number | undefined
        // this loop will play till stock is available, then to the next step
        while (!stock) {
          await this.sleep(this.refreshRate || 5000)
          // every loop iteration the site is refreshed
          await driver
            .navigate()
            .refresh()
            .catch(() => driver.navigate().to(this.link))
          // when item is not in stock, the button that informs you that there's no stock has the id 'notify-me'. If it's found there's not stock.
          // Else, proceeds to check the price and compare it to the maximum price if provided
          await driver
            .findElement(By.id('notify-me'))
            .then(() => console.log(`Product is not yet in stock (${new Date().toUTCString()})`))
            .catch(async () => {
              await driver
                .findElement(By.id('precio-main'))
                .then(async value => (price = parseFloat(await value.getAttribute('data-price'))))
                .catch(() => console.error("Couldn't find item price"))
              // checks if current price is below max price before continuing
              if (
                this.maxPrice === undefined ||
                (price && this.maxPrice && price <= this.maxPrice)
              ) {
                stock = true
                console.log(`PRODUCT IN STOCK! Starting buy process`)
                this.sendSms('IN STOCK! ATTEMPTING TO BUY')
              } else {
                console.log(
                  `Price is above max. Max price set - ${this.maxPrice}€. Current price - ${price}€`
                )
              }
            })
        }
      })
  }

  async buyItem(driver: WebDriver) {
    await this.sleep(2000)
    // check if there is a cookies modal to accept
    await driver
      .findElement(By.className('btn btn-block btn-primary btn-lg m-t-1 accept-cookie'))
      .then(value => value.click())
      .catch(() => console.log('No cookie accept button to click'))
    // clicks on buy button on product page. There are 3 buttons that show up depending on the current window size.
    // the bot will attempt to click all of them
    const buyButtons = await driver.findElements(By.className('buy-button'))
    let clickedButton = false
    buyButtons.forEach(async buyButton => {
      if (!clickedButton)
        try {
          await buyButton.click()
          clickedButton = true
        } catch {
          console.log('Buy button not found, attempting another one...')
        }
    })
    await this.sleep(3000)
    await driver.findElement(By.id('GTM-carrito-realizarPedidoPaso1')).then(value => value.click())
    await this.sleep(3000)
    // checks if the account has an added card, if not it adds the provided one
    await driver.findElements(By.className('h5 card-name')).then(async value => {
      if ((await value[0].getAttribute('outerText')) === 'Nombre aquí')
        this.card
          ? await this.addCard(driver)
          : console.error("ERROR: You have no card on your account and you didn't provide any")
    })
    await driver
      .findElements(By.className('c-indicator margin-top-0'))
      .then(value => value[0].click())
      .catch(reason => console.error(reason))
    await this.sleep(500)
    await driver
      .findElement(By.id('GTM-carrito-finalizarCompra'))
      .then(value => value.click())
      .catch(() => console.error("Couldn't click the buy button. FUUUUUCK"))
    for (var i = 0; i < 50; i++) console.log('COMPRADO')
    this.sendSms('DONE. CHECK YOUR ORDERS!')
  }

  async addCard(driver: WebDriver) {
    await this.sleep(200)
    // clicking add card button
    await driver
      .findElement(By.id('addNewCard'))
      .then(value => value.click())
      .catch(() => console.error("Didn't find the add card button"))
    await this.sleep(2000)
    const iFrames = await driver.findElements(By.className('js-iframe'))
    /* Card values are secured in 3 different IFrames, 
    we'll switch to each one and introduce the values */
    if (iFrames.length === 3) {
      await driver.switchTo().frame(iFrames[0])
      await driver
        .findElement(By.id('encryptedCardNumber'))
        .then(value => value.sendKeys(parseInt(this.card?.num.trim()!, 10)))
      await driver.switchTo().defaultContent()
      //
      await driver.switchTo().frame(iFrames[1])
      await driver
        .findElement(By.id('encryptedExpiryDate'))
        .then(value => value.sendKeys(parseInt(this.card?.expiryDate.trim()!, 10)))
      await driver.switchTo().defaultContent()
      //
      await driver.switchTo().frame(iFrames[2])
      await driver
        .findElement(By.id('encryptedSecurityCode'))
        .then(value => value.sendKeys(parseInt(this.card?.cvc.trim()!, 10)))
      await driver.switchTo().defaultContent()
      // TODO: FIX
      /* const fields: ICardField[] = [
        { elId: 'encryptedCardNumber', value: parseInt(this.card?.num.trim()!, 10) },
        { elId: 'encryptedExpiryDate', value: parseInt(this.card?.expiryDate.trim()!, 10) },
        { elId: 'encryptedSecurityCode', value: parseInt(this.card?.cvc.trim()!, 10) }
      ]
      iFrames.forEach(async (iframe, i) => {
        await driver.switchTo().frame(iframe)
        await driver
          .findElement(By.id(fields[i].elId))
          .then(value => value.sendKeys(fields[i].value))
          .catch(reason =>
            console.error(`Didn't find credit card field number ${i}. Reason: ${reason}`)
          )
        await driver.switchTo().defaultContent()
        await this.sleep(200)
      }) */
      await driver
        .findElements(By.className('adyen-checkout__card__holderName__input'))
        .then(value => value[0].sendKeys(this.card?.name.trim()!))
      await this.sleep(500)
      //
      await driver
        .findElements(By.className('adyen-checkout__button adyen-checkout__button--pay'))
        .then(value => value[0].click())
      await this.sleep(500)
    } else {
      throw Error(`ERROR: Only ${iFrames.length} found. There must be 3 iframes`)
    }
  }

  async sendSms(msg: string) {
    if (this.phone !== undefined)
      try {
        await fetch('https://rest-api.d7networks.com/secure/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic aWlheTMyMjI6elIyNDVRVGY='
          },
          body: JSON.stringify({
            // @ts-ignore
            content: msg,
            from: 'PCCOM-BOT',
            to: this.phone!
          })
        })
          .then(() => console.log(`SMS sent successfully: ${msg}`))
          .catch(() => console.error(`Error sending SMS: ${msg}`))
      } catch (err) {
        console.error(`Couldn't send SMS: ${err}`)
      }
  }

  async sleep(msec: number) {
    return new Promise(resolve => setTimeout(resolve, msec))
  }
}
