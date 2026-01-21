from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Модели
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(200), nullable=False)  # Увеличил для хэшей
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    
    # Связи
    boards = db.relationship('Board', backref='owner', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.username}>'


class Board(db.Model):
    __tablename__ = 'boards'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    
    # Внешний ключ
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    
    # Связи
    columns = db.relationship('Column', backref='board', lazy=True, cascade='all, delete-orphan', order_by='Column.position')
    
    def __repr__(self):
        return f'<Board {self.title}>'


class Column(db.Model):
    __tablename__ = 'columns'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)  # Увеличил до 100
    position = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    
    # Внешний ключ
    board_id = db.Column(db.Integer, db.ForeignKey('boards.id'), nullable=False, index=True)
    
    # Связи
    tasks = db.relationship('Task', backref='column', lazy=True, cascade='all, delete-orphan', order_by='Task.position')
    
    def __repr__(self):
        return f'<Column {self.title}>'


class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)  # Увеличил до 200
    description = db.Column(db.Text, nullable=True)
    position = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    # Внешний ключ
    column_id = db.Column(db.Integer, db.ForeignKey('columns.id'), nullable=False, index=True)
    
    # Дополнительные поля (опционально, но полезно)
    deadline = db.Column(db.DateTime, nullable=True)
    priority = db.Column(db.Integer, default=0)  # 0=низкий, 1=средний, 2=высокий
    
    def __repr__(self):
        return f'<Task {self.title}>'
    
    def to_dict(self):
        """Метод для удобного преобразования в словарь"""
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'position': self.position,
            'column_id': self.column_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'priority': self.priority
        }