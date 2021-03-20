const scrape = require('scrape-it')

module.exports = async ({ link }) =>
  (
    await scrape(link, {
      price: {
        selector: '#product-page-price',
        attr: 'data-price'
      },
      stock: {
        selector: '.modal-stock-web',
        convert: x => x.includes('En stock') || x.includes('Disponible')
      },
      image: {
        selector: '#ctl00_cphMainContent_ImgProduct',
        attr: 'src'
      },
      name: {
        selector: '.title-1',
        convert: x => x.trim()
      }
    })
  ).data
