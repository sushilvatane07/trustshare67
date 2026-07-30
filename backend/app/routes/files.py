import os
import shutil
from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.file import FileRecord

router = APIRouter(prefix="/files", tags=["files"])

UPLOAD_DIR = "uploaded_files"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
def upload_file(file: UploadFile = File(...), owner_id: int = 1, db: Session = Depends(get_db)):
    save_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    record = FileRecord(
        filename=file.filename,
        owner_id=owner_id,
        content_type=file.content_type,
        size_bytes=os.path.getsize(save_path),
        storage_path=save_path,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "filename": record.filename, "size": record.size_bytes}

@router.get("/")
def list_files(owner_id: int = 1, db: Session = Depends(get_db)):
    return db.query(FileRecord).filter(FileRecord.owner_id == owner_id).all()