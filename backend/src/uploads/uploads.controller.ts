import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Role } from '../auth/enums/role.enum';

const TRYON_UPLOAD_DIR = join(__dirname, '..', '..', 'uploads', 'tryon');
const UUID_PNG = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i;

@Controller('uploads/tryon')
export class UploadsController {
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_request, _file, callback) => {
        try {
          mkdirSync(TRYON_UPLOAD_DIR, { recursive: true });
          callback(null, TRYON_UPLOAD_DIR);
        } catch (error) {
          callback(error as Error, TRYON_UPLOAD_DIR);
        }
      },
      filename: (_request, _file, callback) => callback(null, `${randomUUID()}.png`),
    }),
    limits: { fileSize: 3 * 1024 * 1024, files: 1 },
    fileFilter: (_request, file, callback) => {
      if (file.mimetype !== 'image/png' || extname(file.originalname).toLowerCase() !== '.png') {
        callback(new BadRequestException('Solo se aceptan archivos PNG (image/png).'), false);
        return;
      }
      callback(null, true);
    },
  }))
  upload(@UploadedFile() file: { filename: string } | undefined) {
    if (!file) throw new BadRequestException('Seleccione un archivo PNG.');
    return { url: `/uploads/tryon/${file.filename}` };
  }

  @Get(':filename')
  @Public()
  getImage(@Param('filename') filename: string, @Res() response: Response) {
    if (!UUID_PNG.test(filename)) throw new NotFoundException();
    if (!existsSync(join(TRYON_UPLOAD_DIR, filename))) throw new NotFoundException();
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return response.type('image/png').sendFile(filename, { root: TRYON_UPLOAD_DIR });
  }
}
