import { image } from 'qr-image';
import { createWriteStream } from 'node:fs';
import { checkUserExists } from "./database.js";
import { getverified, getVerifiedTinyUrl } from "./deeplink.js";

const getQr = async () => {
    try {
        if (checkUserExists(userid)) {
            return ({ content: "You have already verified."});
          }
    
          const deeplinkurl = await getverified(userid);
          const tinyurl = await getVerifiedTinyUrl(deeplinkurl);
    
          const qr_png = image(deeplinkurl, { type: 'png' });
          const pngname = `${user.id}_qr_code.png`;
    
          await qr_png.pipe(createWriteStream(`./public/${pngname}`));
          await wait(2000);
          const userqr = [tinyurl, pngname]
          return userqr


    } catch (error){
        console.error(error);
    }
}


const _getQr = getQr;
export { _getQr as getQr };