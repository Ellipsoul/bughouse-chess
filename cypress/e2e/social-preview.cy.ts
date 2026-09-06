/** Exercise crawler metadata and actual PNG rendering through the running Next.js server. */
describe("Dynamic social previews", () => {
  const gameId = "160842422747";
  const crawlerHeaders = { "User-Agent": "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)" };

  it("serves position-specific metadata in the crawler's document head", () => {
    cy.request({ url: `/?gameId=${gameId}&ply=3`, headers: crawlerHeaders }).then(({ body }) => {
      const head = new DOMParser().parseFromString(body, "text/html").head;
      const image = head.querySelector('meta[property="og:image"]')?.getAttribute("content");
      expect(image).to.equal(`${Cypress.config().baseUrl}/api/social-preview?gameId=${gameId}&ply=3`);
      expect(head.querySelector('meta[property="og:url"]')?.getAttribute("content"))
        .to.equal(`${Cypress.config().baseUrl}/?gameId=${gameId}&ply=3`);
    });
    cy.request({ url: "/", headers: crawlerHeaders }).then(({ body }) => {
      const head = new DOMParser().parseFromString(body, "text/html").head;
      expect(head.querySelector('meta[property="og:image"]')?.getAttribute("content")).to.match(/\/og-image\.png$/);
    });
  });

  it("renders different PNGs for the starting and final positions", () => {
    cy.request({ url: `/api/social-preview?gameId=${gameId}&ply=0`, encoding: "binary" }).then(start => {
      const png = Cypress.Buffer.from(start.body, "binary");
      expect(start.headers["content-type"]).to.equal("image/png");
      expect(png.readUInt32BE(16)).to.equal(1200);
      expect(png.readUInt32BE(20)).to.equal(630);
      expect(start.headers["cache-control"]).to.contain("s-maxage=3600");
      cy.request({ url: `/api/social-preview?gameId=${gameId}`, encoding: "binary" }).then(final => {
        expect(final.headers["cache-control"]).to.contain("s-maxage=3600");
        expect(final.body).not.to.equal(start.body);
      });
    });
  });

  it("renders the same position from a saved share and a direct game link", () => {
    cy.clearEmulators();
    cy.task("seedPreviewShare").then(sharedId => {
      cy.request({ url: `/api/social-preview?sharedId=${sharedId}&ply=3`, encoding: "binary" }).then(saved => {
        expect(saved.headers["cache-control"]).to.contain("s-maxage=3600");
        cy.request({ url: `/api/social-preview?gameId=${gameId}&ply=3`, encoding: "binary" }).then(direct => {
          expect(direct.headers["cache-control"]).to.contain("s-maxage=3600");
          expect(saved.body).to.equal(direct.body);
        });
      });
    });
  });
});
